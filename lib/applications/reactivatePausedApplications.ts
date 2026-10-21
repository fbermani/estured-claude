import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";

/**
 * Estados en los que una solicitud del estudiante "avanzó" y por eso mantiene
 * pausadas a las demás (docs/04 §5.4 y §5.6). `submitted`/`under_review`/
 * `queued_for_place` NO cuentan: son las que quedan pausadas, no las que pausan.
 */
const ADVANCING_APPLICATION_STATUSES = [
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
];


/**
 * Docs/04 §5.4 (`paused_due_to_other_active_request → submitted`, Sistema) y
 * §5.6 ("la solicitud pausada se reactiva si la solicitud activa se cancela,
 * vence o no se confirma"). Se llama cuando una solicitud que avanzó vence
 * (`expired_no_student_payment`): si el estudiante ya no tiene ninguna otra
 * solicitud avanzada ni una reserva vigente, sus pausadas vuelven a `submitted`.
 *
 * Es idempotente: se puede llamar de más sin efecto si no hay pausadas o si
 * el estudiante todavía tiene otra solicitud avanzada o una reserva vigente.
 *
 * Supuesto reversible (el doc no lo dice): el plazo de 48 h de respuesta de la
 * residencia (`expires_at`) se reinicia al reactivar; si no, una solicitud que
 * estuvo pausada semanas volvería ya vencida y el job la mataría en la
 * próxima corrida. Nunca lanza: es un efecto secundario del vencimiento.
 */
export async function reactivatePausedApplications(
  admin: SupabaseClient,
  studentProfileId: string,
): Promise<{ reactivatedCount: number }> {
  try {
    const [{ count: advancing }, { count: liveReservations }] = await Promise.all([
      admin
        .from("application_requests")
        .select("id", { count: "exact", head: true })
        .eq("student_profile_id", studentProfileId)
        .in("status", ADVANCING_APPLICATION_STATUSES),
      admin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("student_profile_id", studentProfileId)
        .in("status", [...LIVE_RESERVATION_STATUSES]),
    ]);
    if ((advancing ?? 0) > 0 || (liveReservations ?? 0) > 0) return { reactivatedCount: 0 };

    const newExpiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const { data: reactivated, error } = await admin
      .from("application_requests")
      .update({ status: "submitted", expires_at: newExpiresAt })
      .eq("student_profile_id", studentProfileId)
      .eq("status", "paused_due_to_other_active_request")
      .select("id");
    if (error) {
      console.error("[applications] reactivatePausedApplications failed:", error);
      return { reactivatedCount: 0 };
    }

    for (const row of reactivated ?? []) {
      await admin.from("application_status_events").insert({
        application_request_id: row.id,
        from_status: "paused_due_to_other_active_request",
        to_status: "submitted",
        changed_by_role: "system",
        reason_text: "La otra solicitud del estudiante venció: esta se reactiva.",
      });
      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "application_reactivated_after_pause",
        entityType: "application_requests",
        entityId: row.id,
        source: "system",
      });
    }
    return { reactivatedCount: reactivated?.length ?? 0 };
  } catch (error) {
    console.error("[applications] reactivatePausedApplications threw:", error);
    return { reactivatedCount: 0 };
  }
}
