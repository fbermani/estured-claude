import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyFamilyApplicationMilestone } from "@/lib/family/familyMilestones";
import { createAuditLog } from "@/lib/audit";
import { promoteNextQueuedApplication } from "@/lib/applications/roomTypeQueue";
import { reactivatePausedApplications } from "@/lib/applications/reactivatePausedApplications";

/**
 * Job `expire_application_requests` (docs/07 §15.10, §31) — cada hora.
 * Cubre las reglas que le corresponden directamente (la de propuesta de
 * ajuste vencida la resuelve `expireNegotiationProposals` — docs/07 §15.10
 * remite explícitamente al job 15.6 para ese caso):
 *
 * - sin respuesta de la residencia (`submitted`/`under_review`) →
 *   `expired_no_residence_response`;
 * - sin pago a la residencia dentro de 48h (`contact_established` o
 *   `residence_payment_pending` con `payment_deadline_at` vencido) →
 *   `expired_no_student_payment` (docs/04 l.302-303; `contact_established`
 *   se sumó en el Ciclo 49, H06/D6), y reactiva las solicitudes pausadas
 *   del estudiante si ya no le queda otra avanzada (docs/04 §5.6).
 *
 * Bug de consistencia real encontrado y corregido en el Ciclo 34terdecies:
 * `createPendingResidencePayment` (Ciclo 8) ya crea una fila real de
 * `external_residence_payments` en `pending` al entrar a
 * `residence_payment_pending` — pero hasta acá nada la sincronizaba al
 * vencer la solicitud. Quedaba huérfana en `pending`/
 * `student_reference_uploaded` para siempre, en desacuerdo con su propia
 * solicitud padre ya `expired_no_student_payment`.
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
    .select("id, room_type_id");
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
    if (row.room_type_id) await promoteNextQueuedApplication(admin, row.room_type_id);
    await notifyFamilyApplicationMilestone(admin, row.id, "expired_no_response");
    expiredCount += 1;
  }

  // docs/04 l.302-303: `contact_established` y `residence_payment_pending` vencen igual, a las 48h
  // de `payment_deadline_at`. `contact_established` no vencía nunca (H06): quedaba zombi y, como
  // establecer contacto pausa las demás solicitudes del estudiante, las dejaba pausadas para siempre.
  const legacyCutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const paymentPasses = [
    { fromStatus: "contact_established", legacy: false },
    // Filas de contacto establecido sin `payment_deadline_at` (cargadas por seed, anteriores a que
    // `establishContact` lo escribiera): el plazo es el mismo, 48h desde `contact_established_at`.
    { fromStatus: "contact_established", legacy: true },
    { fromStatus: "residence_payment_pending", legacy: false },
  ] as const;
  for (const { fromStatus, legacy } of paymentPasses) {
    const base = admin
      .from("application_requests")
      .update({ status: "expired_no_student_payment" })
      .eq("status", fromStatus);
    const { data: noStudentPayment, error: noPaymentError } = await (
      legacy
        ? base.is("payment_deadline_at", null).lt("contact_established_at", legacyCutoff)
        : base.lt("payment_deadline_at", now)
    ).select("id, room_type_id, student_profile_id");
    if (noPaymentError) {
      console.error(`[jobs] expireApplicationRequests (sin pago, ${fromStatus}) failed:`, noPaymentError);
    }
    for (const row of noStudentPayment ?? []) {
      await admin.from("application_status_events").insert({
        application_request_id: row.id,
        from_status: fromStatus,
        to_status: "expired_no_student_payment",
        changed_by_role: "system",
        reason_text: "El estudiante no pagó a la residencia dentro del plazo de 48h.",
      });
      const { error: residencePaymentSyncError } = await admin
        .from("external_residence_payments")
        .update({ status: "expired" })
        .eq("application_request_id", row.id)
        .in("status", ["pending", "student_reference_uploaded"]);
      if (residencePaymentSyncError) {
        console.error("[jobs] expireApplicationRequests (sync external_residence_payments) failed:", residencePaymentSyncError);
      }
      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "application_expired_no_student_payment",
        entityType: "application_requests",
        entityId: row.id,
        oldValue: { status: fromStatus },
        newValue: { status: "expired_no_student_payment" },
        source: "system",
      });
      if (row.room_type_id) await promoteNextQueuedApplication(admin, row.room_type_id);
      // docs/04 §5.6: las solicitudes pausadas del estudiante se reactivan cuando la activa vence.
      if (row.student_profile_id) await reactivatePausedApplications(admin, row.student_profile_id);
      await notifyFamilyApplicationMilestone(admin, row.id, "expired_no_payment");
      expiredCount += 1;
    }
  }

  return { expiredCount };
}
