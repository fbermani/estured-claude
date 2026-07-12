import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type StayInWaitlistResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/08 §6.10 ("quedarme en lista") — el estudiante confirma que sigue
 * interesado después de una notificación de disponibilidad o del aviso
 * de retención a los 90 días, sin salir de la lista. Vuelve a `active`.
 */
export async function stayInWaitlist(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string },
): Promise<StayInWaitlistResult> {
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
  if (!["availability_notification_sent", "retention_check_sent"].includes(entry.status)) {
    return { ok: false, error: "Esta entrada no tiene una notificación pendiente de confirmar." };
  }

  const { error } = await admin.from("waitlist_entries").update({ status: "active" }).eq("id", entry.id);
  if (error) {
    console.error("[waitlist] stayInWaitlist update failed:", error);
    return { ok: false, error: "No pudimos actualizar tu lista de espera. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "waitlist_entry_stayed",
    entityType: "waitlist_entries",
    entityId: entry.id,
    source: "user",
  });

  return { ok: true };
}
