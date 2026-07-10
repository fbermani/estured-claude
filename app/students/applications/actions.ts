"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";

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
  const durationMonths = Number(formData.get("initial_duration_months") ?? 0);
  const academicObjective = String(formData.get("academic_objective") ?? "").trim();

  if (!desiredStartDate) return { status: "error", message: "Elegí una fecha de ingreso estimada." };
  if (durationMonths < 1 || durationMonths > 24)
    return { status: "error", message: "La duración debe ser entre 1 y 24 meses." };
  if (academicObjective.length < 10)
    return {
      status: "error",
      message: "Contanos brevemente tu objetivo académico (obligatorio para el comprobante).",
    };

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

  const { data: residence } = await admin
    .from("residences")
    .select("id, status")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence || residence.status !== "verified_active") {
    return { status: "error", message: "Esta residencia ya no está disponible para solicitar." };
  }

  const { data: roomType } = await admin
    .from("room_types")
    .select(
      "id, monthly_price_usd, enrollment_fee_usd, deposit_usd, adjustment_policy, is_active, profile_availability(status)",
    )
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  const availability = roomType?.profile_availability as unknown as { status: string }[] | undefined;
  if (!roomType || !roomType.is_active) {
    return { status: "error", message: "Ese tipo de habitación ya no está disponible." };
  }
  if (availability?.[0]?.status === "full") {
    return { status: "error", message: "Esa habitación ya no tiene lugar. Probá otro tipo." };
  }

  const result = await createApplicationFromRoomType(admin, {
    studentProfileId: studentProfile.id,
    residenceId,
    roomTypeId,
    roomType: {
      monthly_price_usd: Number(roomType.monthly_price_usd),
      enrollment_fee_usd: roomType.enrollment_fee_usd ? Number(roomType.enrollment_fee_usd) : null,
      deposit_usd: roomType.deposit_usd ? Number(roomType.deposit_usd) : null,
      adjustment_policy: roomType.adjustment_policy,
    },
    desiredStartDate,
    durationMonths,
    academicObjective,
    initiatedBy: "student",
    contactTarget,
    familyLinkId,
    familyProposalId: null,
    createdByUserId: sessionUser.id,
    actorRole: "student",
  });
  if ("error" in result) return { status: "error", message: result.error };

  redirect(`/students/applications/${result.id}`);
}
