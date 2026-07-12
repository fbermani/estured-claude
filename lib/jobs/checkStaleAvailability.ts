import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

const NOT_UPDATED_AFTER_DAYS = 30;
const HIDDEN_AFTER_DAYS = 45; // 30 + 15, docs/04 §10.4

/**
 * Job `check_stale_availability` (docs/04 §10.4, docs/12 §9.2) — no
 * nombrado explícitamente en la lista de jobs a 48h de docs/07 §31 (esos
 * son todos de 48h; este es de 30/15 días), así que se agrega al mismo
 * endpoint horario existente (`runExpirationJobs`) en vez de crear
 * infraestructura de cron nueva — correr un chequeo de umbral de días
 * cada hora es idempotente y no tiene costo real.
 */
export async function checkStaleAvailability(admin: SupabaseClient): Promise<{ markedStale: number; hiddenCount: number }> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - NOT_UPDATED_AFTER_DAYS * 24 * 3_600_000).toISOString();
  const hiddenThreshold = new Date(now.getTime() - HIDDEN_AFTER_DAYS * 24 * 3_600_000).toISOString();

  const { data: nowStale, error: staleError } = await admin
    .from("profile_availability")
    .update({ status: "not_updated" })
    .eq("status", "available_to_confirm")
    .lt("last_confirmed_at", staleThreshold)
    .select("id");
  if (staleError) console.error("[jobs] checkStaleAvailability (not_updated) failed:", staleError);
  for (const row of nowStale ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "availability_marked_not_updated",
      entityType: "profile_availability",
      entityId: row.id,
      source: "system",
    });
  }

  const { data: nowHidden, error: hiddenError } = await admin
    .from("profile_availability")
    .update({ hidden_from_search_at: now.toISOString() })
    .eq("status", "not_updated")
    .lt("last_confirmed_at", hiddenThreshold)
    .is("hidden_from_search_at", null)
    .select("id");
  if (hiddenError) console.error("[jobs] checkStaleAvailability (hidden) failed:", hiddenError);
  for (const row of nowHidden ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "availability_hidden_from_search",
      entityType: "profile_availability",
      entityId: row.id,
      source: "system",
    });
  }

  return { markedStale: (nowStale ?? []).length, hiddenCount: (nowHidden ?? []).length };
}
