import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { currentMonthStart, WAITLIST_MONTH_PASSED_REASON } from "@/lib/waitlist-entries/desiredMonth";

/** Estados que vencen por mes. `availability_notification_sent` NO: está a mitad de flujo (DR40, supuesto reversible). */
export const EXPIRABLE_WAITLIST_STATUSES = ["active", "retention_check_sent"] as const;

type ExpiringRow = {
  id: string;
  student_profiles: { user_id: string } | null;
  residences: { name: string } | null;
};

/**
 * Job de vencimiento de la lista de espera por mes (DR40, docs/00 §31, 2026-11-07; docs/06 §27.8).
 * Pasa a `expired` (`removed_at`, `removed_reason = 'month_passed'`) las entradas `active` y `retention_check_sent` cuyo mes de
 * ingreso ya terminó: `desired_start_date` (día 1 del mes) anterior al primer día del mes en curso en Buenos Aires. Sin mes
 * (`null`) no vence. Avisa una sola vez al estudiante. Idempotente (filtra por estado al actualizar). Nunca lanza.
 */
export async function expireWaitlistByMonth(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ expiredCount: number }> {
  let expiredCount = 0;
  try {
    const { data, error } = await admin
      .from("waitlist_entries")
      .select("id, student_profiles (user_id), residences (name)")
      .in("status", [...EXPIRABLE_WAITLIST_STATUSES])
      .not("desired_start_date", "is", null)
      .lt("desired_start_date", currentMonthStart(now));
    if (error) {
      console.error("[jobs] expireWaitlistByMonth query failed:", error);
      return { expiredCount };
    }

    for (const row of (data as unknown as ExpiringRow[]) ?? []) {
      const { data: updated, error: updateError } = await admin
        .from("waitlist_entries")
        .update({
          status: "expired",
          removed_at: now.toISOString(),
          removed_reason: WAITLIST_MONTH_PASSED_REASON,
        })
        .eq("id", row.id)
        .in("status", [...EXPIRABLE_WAITLIST_STATUSES])
        .select("id");
      if (updateError) {
        console.error("[jobs] expireWaitlistByMonth update failed:", updateError);
        continue;
      }
      if (!updated?.length) continue; // otro proceso ya la cambió
      expiredCount += 1;

      await createAuditLog(admin, {
        actorUserId: null,
        actorRole: "system",
        action: "waitlist_entry_expired_month_passed",
        entityType: "waitlist_entries",
        entityId: row.id,
        source: "system",
      });

      const userId = row.student_profiles?.user_id;
      if (userId) {
        const residenceName = row.residences?.name ?? "la residencia";
        await createNotification(admin, {
          userId,
          title: "Tu lugar en la lista de espera venció",
          body: `Tu lugar en la lista de espera de ${residenceName} venció porque pasó el mes elegido. Podés sumarte de nuevo.`,
          relatedEntityType: "waitlist_entries",
          relatedEntityId: row.id,
        });
      }
    }
  } catch (err) {
    console.error("[jobs] expireWaitlistByMonth failed:", err);
  }
  return { expiredCount };
}
