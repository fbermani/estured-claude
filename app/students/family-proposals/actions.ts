"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { recordFamilyProposalResponse } from "@/lib/applications/recordFamilyProposalResponse";
import { loadRequestableRoomType } from "@/lib/availability/loadRequestableRoomType";
import { checkReservationWindowOverlap } from "@/lib/students/reservationWindow";
import { MAX_APPLICATION_TEXT, checkTextMax, isIsoDate, parseDurationMonths } from "@/lib/applications/inputLimits";
import { guardianConsentMissing, minorHoldError } from "@/lib/students/minorHold";

export type CreateFamilyProposalState = { status: "idle" | "error"; message?: string };
export type RespondFamilyProposalState = { status: "idle" | "error"; message?: string };

/**
 * Crear propuesta de solicitud del familiar (docs/07 §9.1, docs/03
 * §10bis). No es una solicitud activa, no la ve la residencia hasta
 * que el estudiante la aprueba (`respondFamilyProposal`).
 */
export async function createFamilyProposal(
  residenceId: string,
  _prev: CreateFamilyProposalState,
  formData: FormData,
): Promise<CreateFamilyProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !sessionUser.roles.includes("family_member")) {
    return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  }

  const studentProfileId = String(formData.get("student_profile_id") ?? "");
  const roomTypeId = String(formData.get("room_type_id") ?? "");
  const desiredStartDate = String(formData.get("desired_start_date") ?? "");
  const durationMonths = parseDurationMonths(formData.get("initial_duration_months")) ?? 0;
  const messageToStudent = String(formData.get("message_to_student") ?? "").trim() || null;

  if (!studentProfileId) return { status: "error", message: "Elegí a qué estudiante le proponés esto." };
  if (!roomTypeId) return { status: "error", message: "Elegí un tipo de habitación." };
  if (!desiredStartDate) return { status: "error", message: "Elegí una fecha de ingreso estimada." };
  if (!isIsoDate(desiredStartDate)) return { status: "error", message: "La fecha de ingreso no es válida." };
  if (durationMonths < 1 || durationMonths > 24)
    return { status: "error", message: "La duración debe ser entre 1 y 24 meses." };
  const messageCheck = checkTextMax(messageToStudent, MAX_APPLICATION_TEXT, "El mensaje");
  if (!messageCheck.ok) return { status: "error", message: messageCheck.error };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: familyMember } = await admin
    .from("family_members")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!familyMember) return { status: "error", message: "No encontramos tu perfil de familiar." };

  const { data: link } = await admin
    .from("family_links")
    .select("id, permissions")
    .eq("family_member_id", familyMember.id)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return { status: "error", message: "No tenés un vínculo activo con ese estudiante." };
  const permissions = link.permissions as { can_create_proposals?: boolean } | null;
  if (permissions?.can_create_proposals === false) {
    return { status: "error", message: "No tenés permiso para crear propuestas para este estudiante." };
  }
  // DR65 (e): por un menor, el familiar primero da su consentimiento como responsable.
  if (await guardianConsentMissing(admin, studentProfileId, sessionUser.id)) {
    return { status: "error", message: "Primero dá tu consentimiento como familiar responsable desde tu panel." };
  }

  // Ciclo 58: no se propone para fechas que se superpongan con una reserva vigente del estudiante (se vuelve a
  // validar al aprobar, en `recordFamilyProposalResponse`).
  const overlap = await checkReservationWindowOverlap(admin, {
    studentProfileId,
    desiredStartDate,
    durationMonths,
    audience: "family",
    residenceId,
  });
  if (!overlap.ok) return { status: "error", message: overlap.error };

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence || residence.status !== "verified_active") {
    return { status: "error", message: "Esta residencia ya no está disponible para proponer." };
  }

  const requestable = await loadRequestableRoomType(admin, residenceId, roomTypeId);
  if (!requestable.ok) {
    return { status: "error", message: requestable.error };
  }

  const { data: proposal, error } = await admin
    .from("family_application_proposals")
    .insert({
      family_link_id: link.id,
      family_member_id: familyMember.id,
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      room_type_id: roomTypeId,
      desired_start_date: desiredStartDate,
      initial_duration_months: durationMonths,
      message_to_student: messageToStudent,
    })
    .select("id")
    .single();
  if (error || !proposal) {
    console.error("[family-proposal] create failed:", error);
    return { status: "error", message: "No pudimos enviar la propuesta. Intentá de nuevo en unos minutos." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "family_member",
    action: "family_proposal_created",
    entityType: "family_application_proposals",
    entityId: proposal.id,
    newValue: { residence_id: residenceId, room_type_id: roomTypeId, student_profile_id: studentProfileId },
  });

  redirect("/students/dashboard");
}

/**
 * Capa fina (docs/07 §9.2-9.3) — resuelve sesión, parsea `FormData` y
 * delega toda la lógica de negocio a `recordFamilyProposalResponse`
 * (extraída en el Ciclo 21, GAPS.md, para que sea testeable sin
 * `next/headers`). `redirect()` queda acá porque solo funciona dentro
 * del ciclo de vida real de un Server Action.
 */
export async function respondFamilyProposal(
  proposalId: string,
  decision: "approve" | "reject",
  _prev: RespondFamilyProposalState,
  formData: FormData,
): Promise<RespondFamilyProposalState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  // DR65 (e): la cuenta de un menor sin consentimiento del familiar está en espera.
  const onHold = await minorHoldError(admin, sessionUser.id);
  if (onHold) return { status: "error", message: onHold };

  const result = await recordFamilyProposalResponse(admin, {
    proposalId,
    decision,
    actorUserId: sessionUser.id,
    rejectionReason: decision === "reject" ? String(formData.get("reason") ?? "").trim() || null : null,
    academicObjective: decision === "approve" ? String(formData.get("academic_objective") ?? "").trim() : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  if (decision === "reject") {
    revalidatePath("/students/family-proposals");
    revalidatePath("/students/dashboard");
    return { status: "idle" };
  }

  revalidatePath("/students/family-proposals");
  redirect(`/students/applications/${result.applicationId}`);
}
