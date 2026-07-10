import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

/**
 * Job `expire_application_requests` (docs/07 §15.10, §31) — cada hora.
 * Cubre las 2 reglas que le corresponden directamente (la 3ra, la de
 * propuesta de ajuste vencida, la resuelve `expireNegotiationProposals`
 * — docs/07 §15.10 remite explícitamente al job 15.6 para ese caso):
 *
 * - sin respuesta de la residencia (`submitted`/`under_review`) →
 *   `expired_no_residence_response`;
 * - sin pago a la residencia dentro de 48h de `contact_established`
 *   (`residence_payment_pending`, `payment_deadline_at` vencido) →
 *   `expired_no_student_payment`.
 *
 * Sin notificación real (pendiente, docs/00 §29) y sin liberar
 * disponibilidad automáticamente — docs/00 §9.1 dice que la residencia
 * "puede" liberar la plaza tras el vencimiento, una acción manual
 * posterior, no un efecto automático de este job.
 */
export async function expireApplicationRequests(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const now = new Date().toISOString();
  let expiredCount = 0;

  const { data: noResidenceResponse, error: noResponseError } = await admin
    .from("application_requests")
    .update({ status: "expired_no_residence_response" })
    .in("status", ["submitted", "under_review"])
    .lt("expires_at", now)
    .select("id");
  if (noResponseError) {
    console.error("[jobs] expireApplicationRequests (sin respuesta) failed:", noResponseError);
  }
  for (const row of noResidenceResponse ?? []) {
    await admin.from("application_status_events").insert({
      application_request_id: row.id,
      to_status: "expired_no_residence_response",
      changed_by_role: "system",
      reason_text: "La residencia no respondió dentro del plazo de 48h.",
    });
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "application_expired_no_residence_response",
      entityType: "application_requests",
      entityId: row.id,
      source: "system",
    });
    expiredCount += 1;
  }

  const { data: noStudentPayment, error: noPaymentError } = await admin
    .from("application_requests")
    .update({ status: "expired_no_student_payment" })
    .eq("status", "residence_payment_pending")
    .lt("payment_deadline_at", now)
    .select("id");
  if (noPaymentError) {
    console.error("[jobs] expireApplicationRequests (sin pago) failed:", noPaymentError);
  }
  for (const row of noStudentPayment ?? []) {
    await admin.from("application_status_events").insert({
      application_request_id: row.id,
      from_status: "residence_payment_pending",
      to_status: "expired_no_student_payment",
      changed_by_role: "system",
      reason_text: "El estudiante no pagó a la residencia dentro del plazo de 48h.",
    });
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "application_expired_no_student_payment",
      entityType: "application_requests",
      entityId: row.id,
      source: "system",
    });
    expiredCount += 1;
  }

  return { expiredCount };
}
