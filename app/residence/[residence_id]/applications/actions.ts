"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { ACTIVE_APPLICATION_STATUSES, REJECTION_REASONS } from "@/lib/applications/types";
import { createPendingResidencePayment } from "@/lib/applications/residencePayment";

export type ApplicationActionState = { status: "idle" | "error" | "saved"; message?: string };

const REASON_CODES = new Set(REJECTION_REASONS.map((r) => r.value));

async function loadAndAuthorize(admin: ReturnType<typeof getSupabaseAdmin>, applicationId: string, userId: string) {
  const { data: application } = await admin!
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, proposal_count, snapshot_original_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { error: "No encontramos esa solicitud." as const };

  const hasAccess = await assertResidenceAccess(admin!, userId, application.residence_id);
  if (!hasAccess) return { error: "No tenés acceso a esa residencia." as const };

  return { application };
}

/** Docs/07 §15.2 — marcar una solicitud recién llegada como en revisión. */
export async function markUnderReview(applicationId: string): Promise<ApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id);
  if ("error" in result) return { status: "error", message: result.error };
  if (result.application.status !== "submitted") {
    return { status: "error", message: "Esa solicitud ya no está en estado 'nueva'." };
  }

  const { error } = await admin
    .from("application_requests")
    .update({ status: "under_review" })
    .eq("id", applicationId);
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "submitted",
    to_status: "under_review",
    changed_by_user_id: sessionUser.id,
    changed_by_role: "residence_owner",
  });

  revalidatePath(`/residence/${result.application.residence_id}/applications`);
  return { status: "saved" };
}

/**
 * Docs/07 §15.3 — establecer contacto. Detiene el vencimiento de 48h
 * de la solicitud, abre la ventana de pago a residencia (fase
 * siguiente), y pausa otras solicitudes activas del mismo estudiante
 * (docs/00 §9: "si una solicitud avanza, la otra queda pausada").
 */
export async function establishContact(applicationId: string): Promise<ApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id);
  if ("error" in result) return { status: "error", message: result.error };
  if (!["submitted", "under_review"].includes(result.application.status)) {
    return { status: "error", message: "Esa solicitud no está en un estado válido para establecer contacto." };
  }

  const now = new Date();
  const paymentDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { error } = await admin
    .from("application_requests")
    .update({
      status: "contact_established",
      contact_established_at: now.toISOString(),
      payment_deadline_at: paymentDeadline.toISOString(),
    })
    .eq("id", applicationId);
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: result.application.status,
    to_status: "contact_established",
    changed_by_user_id: sessionUser.id,
    changed_by_role: "residence_owner",
  });

  // Pausar otras solicitudes activas del mismo estudiante.
  const { data: others } = await admin
    .from("application_requests")
    .select("id, status")
    .eq("student_profile_id", result.application.student_profile_id)
    .neq("id", applicationId)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  for (const other of others ?? []) {
    await admin
      .from("application_requests")
      .update({ status: "paused_due_to_other_active_request" })
      .eq("id", other.id);
    await admin.from("application_status_events").insert({
      application_request_id: other.id,
      from_status: other.status,
      to_status: "paused_due_to_other_active_request",
      changed_by_role: "system",
      reason_text: "Otra solicitud del mismo estudiante estableció contacto primero.",
    });
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "residence_owner",
    action: "application_contact_established",
    entityType: "application_requests",
    entityId: applicationId,
  });

  revalidatePath(`/residence/${result.application.residence_id}/applications`);
  return { status: "saved" };
}

/**
 * Docs/04 §5.4: `contact_established → residence_payment_pending` sin
 * propuesta de ajuste — la residencia confirma que las condiciones
 * originales están bien y habilita el pago directamente. Gap encontrado
 * en esta sesión: antes de este fix no existía forma de avanzar una
 * solicitud que llegó a `contact_established` sin negociación (el único
 * camino cableado era enviar una propuesta).
 */
export async function enableResidencePayment(applicationId: string): Promise<ApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id);
  if ("error" in result) return { status: "error", message: result.error };
  if (result.application.status !== "contact_established") {
    return { status: "error", message: "Esa solicitud no está en un estado válido para habilitar el pago." };
  }
  if (result.application.proposal_count > 0) {
    return {
      status: "error",
      message: "Ya enviaste una propuesta de ajuste — el estudiante tiene que responderla primero.",
    };
  }

  const paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const { error } = await admin
    .from("application_requests")
    .update({
      status: "residence_payment_pending",
      snapshot_final_id: result.application.snapshot_original_id,
      payment_deadline_at: paymentDeadline.toISOString(),
    })
    .eq("id", applicationId);
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "contact_established",
    to_status: "residence_payment_pending",
    changed_by_user_id: sessionUser.id,
    changed_by_role: "residence_owner",
    reason_text: "Sin propuesta de ajuste — condiciones originales confirmadas.",
  });

  await createPendingResidencePayment(admin, {
    applicationId,
    residenceId: result.application.residence_id,
    studentProfileId: result.application.student_profile_id,
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "residence_owner",
    action: "residence_payment_enabled_without_negotiation",
    entityType: "application_requests",
    entityId: applicationId,
  });

  revalidatePath(`/residence/${result.application.residence_id}/applications/${applicationId}`);
  return { status: "saved" };
}

/** Docs/07 §15.7 — rechazar con motivo predefinido. */
export async function rejectApplication(
  applicationId: string,
  _prev: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id);
  if ("error" in result) return { status: "error", message: result.error };
  if (["rejected", "cancelled_by_student", "converted_to_reservation"].includes(result.application.status)) {
    return { status: "error", message: "Esa solicitud ya está cerrada." };
  }

  const reasonCode = String(formData.get("reason_code") ?? "");
  const reasonText = String(formData.get("reason_text") ?? "").trim();
  if (!REASON_CODES.has(reasonCode as never)) {
    return { status: "error", message: "Elegí un motivo de rechazo." };
  }
  if (reasonCode === "other" && reasonText.length < 5) {
    return { status: "error", message: "Si el motivo es \"Otro\", contanos brevemente por qué." };
  }

  const { error } = await admin
    .from("application_requests")
    .update({
      status: "rejected",
      rejection_reason_code: reasonCode,
      rejection_reason_internal: reasonText || null,
    })
    .eq("id", applicationId);
  if (error) return { status: "error", message: "No pudimos guardar el rechazo." };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: result.application.status,
    to_status: "rejected",
    changed_by_user_id: sessionUser.id,
    changed_by_role: "residence_owner",
    reason_code: reasonCode,
    reason_text: reasonText || null,
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "residence_owner",
    action: "application_rejected",
    entityType: "application_requests",
    entityId: applicationId,
    reasonCode,
    reasonText: reasonText || undefined,
  });

  revalidatePath(`/residence/${result.application.residence_id}/applications`);
  return { status: "saved" };
}
