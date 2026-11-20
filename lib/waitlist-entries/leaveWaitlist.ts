import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type LeaveWaitlistResult = { ok: true } | { ok: false; error: string };

/** Docs/08 §6.10 — el estudiante se saca de la lista de espera por su cuenta. */
export async function leaveWaitlist(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string },
): Promise<LeaveWaitlistResult> {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, student_profile_id, status")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry || entry.student_profile_id !== studentProfile.id) {
    return { ok: false, error: "No encontramos esa entrada en tu lista de espera." };
  }
  if (!["active", "availability_notification_sent", "retention_check_sent"].includes(entry.status)) {
    return { ok: false, error: "Esta entrada ya no está activa." };
  }

  const { data: updated, error } = await admin
    .from("waitlist_entries")
    .update({ status: "removed_by_student", removed_at: new Date().toISOString(), removed_by: params.actorUserId })
    .eq("id", entry.id)
    .eq("status", entry.status)
    .select("id");
  if (!error && (updated ?? []).length === 0) {
    return { ok: false, error: "La entrada cambió mientras tanto. Recargá la página." };
  }
  if (error) {
    console.error("[waitlist] leaveWaitlist update failed:", error);
    return { ok: false, error: "No pudimos sacarte de la lista de espera. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "waitlist_entry_left",
    entityType: "waitlist_entries",
    entityId: entry.id,
    source: "user",
  });

  return { ok: true };
}
