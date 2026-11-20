"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";
import { requestBlockedMessage, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { checkReservationWindowOverlap } from "@/lib/students/reservationWindow";
import { validateMovingNote } from "@/lib/stayChange/validate";
import { MAX_APPLICATION_TEXT, checkTextMax, isIsoDate, parseDurationMonths } from "@/lib/applications/inputLimits";
import { acceptRegulationForApplication, recordRegulationAcceptance, resolveRegulationToAccept } from "@/lib/regulations/acceptance";
import { revalidatePath } from "next/cache";

export type CreateApplicationState = { status: "idle" | "error"; message?: string };

/**
 * Crear solicitud de reserva (docs/07 §15.1, docs/00 §9-10) iniciada
 * directamente por el estudiante. La variante iniciada por el familiar
 * (propuesta aprobada) vive en `app/students/family-proposals/actions.ts`
 * y reusa `createApplicationFromRoomType` (Ciclo 12) para no duplicar
 * la lógica de snapshot/fee.
 */
export async function createApplicationRequest(
  residenceId: string,
  _prev: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };

  const roomTypeId = String(formData.get("room_type_id") ?? "");
  if (!roomTypeId) return { status: "error", message: "Elegí un tipo de habitación." };
  const desiredStartDate = String(formData.get("desired_start_date") ?? "");
  const durationMonths = parseDurationMonths(formData.get("initial_duration_months")) ?? 0;
  const academicObjectiveChoice = String(formData.get("academic_objective_choice") ?? "").trim();
  const academicObjectiveDetail = String(formData.get("academic_objective_detail") ?? "").trim();
  const academicObjective = academicObjectiveDetail
    ? `${academicObjectiveChoice}. ${academicObjectiveDetail}`
    : academicObjectiveChoice;

  if (!desiredStartDate) return { status: "error", message: "Elegí una fecha de ingreso estimada." };
  if (!isIsoDate(desiredStartDate)) return { status: "error", message: "La fecha de ingreso no es válida." };
  if (durationMonths < 1 || durationMonths > 24)
    return { status: "error", message: "La duración debe ser entre 1 y 24 meses." };
  if (!academicObjectiveChoice)
    return { status: "error", message: "Elegí una opción para tu objetivo académico." };
  const objectiveCheck = checkTextMax(academicObjective, MAX_APPLICATION_TEXT, "El objetivo académico");
  if (!objectiveCheck.ok) return { status: "error", message: objectiveCheck.error };
  // DR3: nota voluntaria para la residencia nueva (solo se guarda si la solicitud se permitió por el aviso "Quiero cambiar").
  const movingNote = validateMovingNote(formData.get("move_context_note"));
  if (!movingNote.ok) return { status: "error", message: movingNote.error };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id, is_minor, academic_objective")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  // Docs/06 §5.1: teléfono del destinatario del contacto es obligatorio.
  // Docs/00 §17.3: si es menor, el contacto va siempre al familiar.
  let contactTarget: "student" | "family_member" = "student";
  let familyLinkId: string | null = null;

  if (studentProfile.is_minor) {
    const { data: link } = await admin
      .from("family_links")
      .select("id, family_members(phone)")
      .eq("student_profile_id", studentProfile.id)
      .eq("status", "active")
      .maybeSingle();
    const familyMember = link?.family_members as unknown as { phone: string | null } | null;
    if (!link || !familyMember?.phone) {
      return {
        status: "error",
        message:
          "Sos menor de edad: necesitás un familiar vinculado con teléfono cargado para poder solicitar.",
      };
    }
    contactTarget = "family_member";
    familyLinkId = link.id;
  } else {
    const { data: appUser } = await admin.from("users").select("phone").eq("id", sessionUser.id).single();
    if (!appUser?.phone) {
      return { status: "error", message: "Necesitás tener un teléfono cargado para poder solicitar." };
    }
  }

  // Máximo 2 solicitudes activas (docs/00 §9).
  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", studentProfile.id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return {
      status: "error",
      message: "Ya tenés 2 solicitudes activas — es el máximo permitido. Cerrá una para poder enviar otra.",
    };
  }

  // Ciclo 58: con una reserva vigente no se puede solicitar para fechas que se superpongan con ella.
  const overlap = await checkReservationWindowOverlap(admin, {
    studentProfileId: studentProfile.id,
    desiredStartDate,
    durationMonths,
    residenceId,
  });
  if (!overlap.ok) return { status: "error", message: overlap.error };

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence || residence.status !== "verified_active") {
    return { status: "error", message: "Esta residencia ya no está disponible para solicitar." };
  }

  // DR14: el reglamento se acepta al enviar (checkbox obligatorio) y contra la versión vigente que el estudiante vio. Nunca toca los estados.
  const regulation = await resolveRegulationToAccept(admin, {
    residenceId,
    accepted: formData.get("accept_regulation") === "on",
    seenHash: String(formData.get("regulation_hash") ?? "") || null,
  });
  if (!regulation.ok) return { status: "error", message: regulation.error };

  const { data: roomType } = await admin
    .from("room_types")
    .select("id, monthly_price_usd, is_active, profile_availability(status)")
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  // profile_availability tiene unique(room_type_id) — PostgREST devuelve
  // un objeto singular en el embed, no un array.
  const availability = roomType?.profile_availability as unknown as { status: string } | null;
  if (!roomType || !roomType.is_active) {
    return { status: "error", message: "Ese tipo de habitación ya no está disponible." };
  }
  const blockedMessage = requestBlockedMessage(typeAvailabilityState(availability?.status));
  if (blockedMessage) {
    return { status: "error", message: blockedMessage };
  }

  const result = await createApplicationFromRoomType(admin, {
    studentProfileId: studentProfile.id,
    residenceId,
    roomTypeId,
    roomType: { monthly_price_usd: Number(roomType.monthly_price_usd) },
    desiredStartDate,
    durationMonths,
    academicObjective,
    initiatedBy: "student",
    contactTarget,
    familyLinkId,
    familyProposalId: null,
    createdByUserId: sessionUser.id,
    actorRole: "student",
    stayChangeIntentId: overlap.stayChangeIntentId,
    movingContextNote: movingNote.value,
    // DR14: nace marcada como pendiente de aceptación (la residencia no puede avanzarla) y se levanta al registrar la aceptación.
    regulationPending: regulation.regulation.versionId !== null,
  });
  if ("error" in result) return { status: "error", message: result.error };

  // Un estudiante MENOR no acepta por sí mismo (docs/06 §11.5): queda pendiente y lo acepta su familiar vinculado.
  // Para un adulto: si no se pudo registrar tras el reintento, la solicitud queda pendiente (la residencia no la avanza) y se lo lleva a su
  // solicitud, donde ve el aviso con el reglamento y el botón «Leí y acepto».
  if (!studentProfile.is_minor) {
    await recordRegulationAcceptance(admin, {
      applicationRequestId: result.id,
      residenceId,
      regulation: regulation.regulation,
      acceptedByUserId: sessionUser.id,
      acceptedByRole: "student",
    });
  }

  redirect(`/students/applications/${result.id}?enviada=1`);
}

export type AcceptRegulationState = { status: "idle" | "saved" | "error"; message?: string };

/**
 * «Leí y acepto» sobre una solicitud que nació sin la aceptación del reglamento (propuesta del familiar, lista de espera, menor, o un
 * fallo al registrarla; DR14, docs/06 §11.5). Valida en el servidor quién puede aceptar (estudiante mayor o, si es menor, su familiar
 * vinculado) y que se acepte la versión vigente que se leyó. Al registrarla, la residencia puede avanzar la solicitud.
 */
export async function acceptRegulationAction(
  applicationId: string,
  _prev: AcceptRegulationState,
  formData: FormData,
): Promise<AcceptRegulationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const result = await acceptRegulationForApplication(admin, {
    applicationId,
    actorUserId: sessionUser.id,
    accepted: formData.get("accept_regulation") === "on",
    seenHash: String(formData.get("regulation_hash") ?? "") || null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved", message: "Listo, aceptaste el reglamento. La residencia ya puede avanzar con tu solicitud." };
}
