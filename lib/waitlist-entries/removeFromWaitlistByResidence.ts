import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";

export type RemoveFromWaitlistResult = { ok: true } | { ok: false; error: string };

/** Docs/06 §10.2 ("removed_by") — la residencia puede sacar estudiantes de su lista manualmente. */
export async function removeFromWaitlistByResidence(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string; reason: string | null },
): Promise<RemoveFromWaitlistResult> {
  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, residence_id, status")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry) return { ok: false, error: "No encontramos esa entrada de lista de espera." };

  const access = await assertResidencePermission(admin, params.actorUserId, entry.residence_id, "waitlist.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;
  if (!["active", "availability_notification_sent", "retention_check_sent"].includes(entry.status)) {
    return { ok: false, error: "Esta entrada ya no está activa." };
  }

  const { error } = await admin
    .from("waitlist_entries")
    .update({
      status: "removed_by_residence",
      removed_at: new Date().toISOString(),
      removed_by: params.actorUserId,
      removed_reason: params.reason,
    })
    .eq("id", entry.id);
  if (error) {
    console.error("[waitlist] removeFromWaitlistByResidence update failed:", error);
    return { ok: false, error: "No pudimos sacar al estudiante de la lista. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "waitlist_entry_removed_by_residence",
    entityType: "waitlist_entries",
    entityId: entry.id,
    reasonText: params.reason ?? undefined,
  });

  return { ok: true };
}
