"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidencePermission } from "@/lib/residences/access";
import type { ResidencePermission } from "@/lib/residences/permissions";
import { notifyFamilyApplicationMilestone } from "@/lib/family/familyMilestones";
import { notifyStudentApplicationMilestone } from "@/lib/notifications/notifyStudent";
import { createAuditLog } from "@/lib/audit";
import { assertRegulationAccepted } from "@/lib/regulations/gate";
import { checkStayChangeAdvanceGate } from "@/lib/stayChange/advanceGate";
import { ACTIVE_APPLICATION_STATUSES, REJECTION_REASONS } from "@/lib/applications/types";
import { MAX_APPLICATION_TEXT, checkTextMax } from "@/lib/applications/inputLimits";
import { createPendingResidencePayment } from "@/lib/applications/residencePayment";
import { promoteNextQueuedApplication } from "@/lib/applications/roomTypeQueue";
import { reactivatePausedApplications } from "@/lib/applications/reactivatePausedApplications";

export type ApplicationActionState = { status: "idle" | "error" | "saved"; message?: string };

/** Otro actor (o el job de vencimiento) movió la solicitud entre que se cargó la pantalla y se apretó el botón. */
const STALE_STATE_MESSAGE = "La solicitud ya cambió de estado, actualizá la página.";

const REASON_CODES = new Set(REJECTION_REASONS.map((r) => r.value));

/** Estados desde los que la residencia puede rechazar (docs/04 §5.4: `submitted → rejected` y `under_review → rejected`). */
const REJECTABLE_APPLICATION_STATUSES: readonly string[] = ["submitted", "under_review"];

const CLOSED_APPLICATION_STATUSES: readonly string[] = [
  "rejected",
  "cancelled_by_student",
  "cancelled_by_residence",
  "converted_to_reservation",
  "expired_no_residence_response",
  "expired_no_student_payment",
  "expired_offer_no_response",
  "closed_due_to_other_confirmed_reservation",
];

/** Motivo (en español, accionable) por el que una solicitud en este estado no se puede rechazar. */
function rejectBlockedMessage(status: string): string {
  if (CLOSED_APPLICATION_STATUSES.includes(status)) return "Esa solicitud ya está cerrada.";
  if (status === "paused_due_to_other_active_request") {
    return "Esta solicitud está pausada porque el estudiante avanzó con otra residencia. No hace falta que hagas nada.";
  }
  if (["contact_established", "offer_pending_student_acceptance", "conditions_accepted", "residence_payment_pending", "residence_payment_reported"].includes(status)) {
    return "Esta solicitud ya avanzó (contacto, ajuste o pago) y no se puede rechazar desde acá. Si hay un problema, escribí a Soporte desde el panel de la residencia.";
  }
  return "Esta solicitud no está en un estado en el que se pueda rechazar. Si necesitás ayuda, escribí a Soporte.";
}

/**
 * Carga la solicitud y exige el permiso delegable que corresponde a la acción (DR11) en la residencia de ESA solicitud: el rol y los
 * permisos salen de `residence_users`, nunca del formulario ni del id de residencia de la URL.
 */
async function loadAndAuthorize(
  admin: ReturnType<typeof getSupabaseAdmin>,
  applicationId: string,
  userId: string,
  permission: ResidencePermission,
  /** DR14: acciones que AVANZAN la solicitud exigen que el estudiante ya haya aceptado el reglamento (rechazar no avanza: no lo exige). */
  options: { requireRegulation?: boolean } = {},
) {
  const { data: application } = await admin!
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, proposal_count, snapshot_original_id, room_type_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { error: "No encontramos esa solicitud." as const };

  // El rol real del vínculo (dueño o staff) es el que queda en la auditoría.
  const access = await assertResidencePermission(admin!, userId, application.residence_id, permission);
  if (!access.ok) return { error: access.error };

  if (options.requireRegulation) {
    const accepted = await assertRegulationAccepted(admin!, applicationId);
    if (!accepted.ok) return { error: accepted.error };
  }

  return { application, actorRole: access.actorRole };
}

/** Docs/07 §15.2 — marcar una solicitud recién llegada como en revisión. */
export async function markUnderReview(applicationId: string): Promise<ApplicationActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id, "applications.review_contact", { requireRegulation: true });
  if ("error" in result) return { status: "error", message: result.error };
  if (result.application.status !== "submitted") {
    return { status: "error", message: "Esa solicitud ya no está en estado 'nueva'." };
  }

  const { data: reviewRow, error } = await admin
    .from("application_requests")
    .update({ status: "under_review" })
    .eq("id", applicationId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };
  if (!reviewRow) return { status: "error", message: STALE_STATE_MESSAGE };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "submitted",
    to_status: "under_review",
    changed_by_user_id: sessionUser.id,
    changed_by_role: result.actorRole,
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

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id, "applications.review_contact", { requireRegulation: true });
  if ("error" in result) return { status: "error", message: result.error };
  if (!["submitted", "under_review"].includes(result.application.status)) {
    return { status: "error", message: "Esa solicitud no está en un estado válido para establecer contacto." };
  }

  const now = new Date();
  const paymentDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: contactRow, error } = await admin
    .from("application_requests")
    .update({
      status: "contact_established",
      contact_established_at: now.toISOString(),
      payment_deadline_at: paymentDeadline.toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", result.application.status)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };
  if (!contactRow) return { status: "error", message: STALE_STATE_MESSAGE };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: result.application.status,
    to_status: "contact_established",
    changed_by_user_id: sessionUser.id,
    changed_by_role: result.actorRole,
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
    actorRole: result.actorRole,
    action: "application_contact_established",
    entityType: "application_requests",
    entityId: applicationId,
  });
  // DR4: hito para el familiar vinculado (solicitud aceptada).
  await notifyFamilyApplicationMilestone(admin, applicationId, "accepted");
  await notifyStudentApplicationMilestone(admin, applicationId, "accepted");

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

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id, "payments.residence", { requireRegulation: true });
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

  // DR3: una solicitud creada bajo el aviso "Quiero cambiar" no avanza a pago antes de 48 h (supuesto reversible).
  const gate = await checkStayChangeAdvanceGate(admin, { applicationId, audience: "residence" });
  if (!gate.ok) return { status: "error", message: gate.error };

  const paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const { data: enabledRow, error } = await admin
    .from("application_requests")
    .update({
      status: "residence_payment_pending",
      snapshot_final_id: result.application.snapshot_original_id,
      payment_deadline_at: paymentDeadline.toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "contact_established")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: "No pudimos guardar el cambio." };
  if (!enabledRow) return { status: "error", message: STALE_STATE_MESSAGE };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "contact_established",
    to_status: "residence_payment_pending",
    changed_by_user_id: sessionUser.id,
    changed_by_role: result.actorRole,
    reason_text: "Sin propuesta de ajuste — condiciones originales confirmadas.",
  });

  await createPendingResidencePayment(admin, {
    applicationId,
    residenceId: result.application.residence_id,
    studentProfileId: result.application.student_profile_id,
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: result.actorRole,
    action: "residence_payment_enabled_without_negotiation",
    entityType: "application_requests",
    entityId: applicationId,
  });
  // DR4: hito para el familiar vinculado (pago a la residencia pedido).
  await notifyFamilyApplicationMilestone(admin, applicationId, "payment_requested");
  await notifyStudentApplicationMilestone(admin, applicationId, "payment_enabled");

  revalidatePath(`/residence/${result.application.residence_id}/applications`);
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

  const result = await loadAndAuthorize(admin, applicationId, sessionUser.id, "applications.reject");
  if ("error" in result) return { status: "error", message: result.error };
  const currentStatus = result.application.status as string;
  if (currentStatus === "queued_for_place") {
    return {
      status: "error",
      message: "Esta solicitud está en cola — todavía no es visible. Se vuelve rechazable cuando pase a \"Nueva\".",
    };
  }
  // Lista blanca (docs/04 §5.4): la residencia solo rechaza una solicitud "Nueva" (`submitted`) o "En revisión" (`under_review`).
  // `contact_established` NO está permitido (no es una transición del doc ni lo ofrece la pantalla): después de establecer el contacto la
  // solicitud ya "equivale a aceptada" y sigue por ajuste, pago y reserva. Rechazar en esas fases cortaría un pago en curso: lo no
  // rechazable se deriva a Soporte con un mensaje claro, en vez de listar los estados prohibidos (una lista negra deja pasar los nuevos).
  if (!REJECTABLE_APPLICATION_STATUSES.includes(currentStatus)) {
    return { status: "error", message: rejectBlockedMessage(currentStatus) };
  }

  const reasonCode = String(formData.get("reason_code") ?? "");
  const reasonText = String(formData.get("reason_text") ?? "").trim();
  if (!REASON_CODES.has(reasonCode as never)) {
    return { status: "error", message: "Elegí un motivo de rechazo." };
  }
  if (reasonCode === "other" && reasonText.length < 5) {
    return { status: "error", message: "Si el motivo es \"Otro\", contanos brevemente por qué." };
  }
  const reasonCheck = checkTextMax(reasonText, MAX_APPLICATION_TEXT, "El detalle del motivo");
  if (!reasonCheck.ok) return { status: "error", message: reasonCheck.error };

  const { data: rejectedRow, error } = await admin
    .from("application_requests")
    .update({
      status: "rejected",
      rejection_reason_code: reasonCode,
      rejection_reason_internal: reasonText || null,
    })
    .eq("id", applicationId)
    .eq("status", result.application.status)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: "No pudimos guardar el rechazo." };
  if (!rejectedRow) return { status: "error", message: STALE_STATE_MESSAGE };

  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: result.application.status,
    to_status: "rejected",
    changed_by_user_id: sessionUser.id,
    changed_by_role: result.actorRole,
    reason_code: reasonCode,
    reason_text: reasonText || null,
  });

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: result.actorRole,
    action: "application_rejected",
    entityType: "application_requests",
    entityId: applicationId,
    reasonCode,
    reasonText: reasonText || undefined,
  });

  if (result.application.room_type_id) {
    await promoteNextQueuedApplication(admin, result.application.room_type_id);
  }
  // docs/04 §5.6: si la solicitud rechazada era la avanzada, las pausadas del estudiante se reactivan.
  await reactivatePausedApplications(admin, result.application.student_profile_id);

  revalidatePath(`/residence/${result.application.residence_id}/applications`);
  return { status: "saved" };
}
