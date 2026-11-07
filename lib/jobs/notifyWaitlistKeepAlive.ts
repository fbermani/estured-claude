import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

const KEEP_ALIVE_AFTER_DAYS = 90;

/**
 * Job de retención a 90 días (docs/06 §27.8, docs/08 §6.10) — este job NO remueve a nadie (el vencimiento por mes de ingreso es
 * otro job: `expireWaitlistByMonth`, DR40), solo
 * marca `retention_check_sent` para que el estudiante confirme
 * ("quedarme en lista") o se saque él mismo. Sin notificación real
 * todavía (docs/00 §29), mismo criterio que el resto de los jobs.
 */
export async function notifyWaitlistKeepAlive(admin: SupabaseClient): Promise<{ notifiedCount: number }> {
  const threshold = new Date(Date.now() - KEEP_ALIVE_AFTER_DAYS * 24 * 3_600_000).toISOString();

  const { data: dueForCheck, error } = await admin
    .from("waitlist_entries")
    .update({ status: "retention_check_sent", last_keep_alive_notified_at: new Date().toISOString() })
    .eq("status", "active")
    .lt("joined_at", threshold)
    .is("last_keep_alive_notified_at", null)
    .select("id");
  if (error) console.error("[jobs] notifyWaitlistKeepAlive failed:", error);

  for (const row of dueForCheck ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "waitlist_keep_alive_notified",
      entityType: "waitlist_entries",
      entityId: row.id,
      source: "system",
    });
  }

  return { notifiedCount: (dueForCheck ?? []).length };
}
