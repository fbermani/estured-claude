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

  // DR41: «Decidió esperar» solo si venía de un aviso «hay lugar»; en un chequeo de retención no se marca. Sin la migración 0079 degrada sin la marca.
  const markWaiting = entry.status === "availability_notification_sent";
  const doUpdate = (withMark: boolean) =>
    admin
      .from("waitlist_entries")
      .update(withMark ? { status: "active", waiting_confirmed_at: new Date().toISOString() } : { status: "active" })
      .eq("id", entry.id)
      .eq("status", entry.status)
      .select("id");
  let update = await doUpdate(markWaiting);
  if (update.error && markWaiting && (update.error.code === "42703" || update.error.code === "PGRST204")) {
    update = await doUpdate(false);
  }
  if (update.error?.code === "23505") {
    return { ok: false, error: "Ya estás en la lista de esa residencia para este tipo de habitación." };
  }
  if (update.error) {
    console.error("[waitlist] stayInWaitlist update failed:", update.error);
    return { ok: false, error: "No pudimos actualizar tu lista de espera. Intentá de nuevo." };
  }
  if ((update.data ?? []).length === 0) {
    return { ok: false, error: "La entrada cambió mientras tanto. Recargá la página." };
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
