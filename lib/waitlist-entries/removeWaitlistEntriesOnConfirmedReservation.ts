import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

/**
 * Docs/06 §27.8, docs/08 §6.10 ("sale automáticamente si confirma
 * reserva en otra residencia") — se llama desde `confirmAfterFeePaid` y
 * `confirmRenewalAfterFeePaid` al confirmar. Nunca lanza (mismo criterio
 * que `createAuditLog`): no debe poder tumbar la confirmación de una
 * reserva real por un problema en la lista de espera.
 */
export async function removeWaitlistEntriesOnConfirmedReservation(
  admin: SupabaseClient,
  params: { studentProfileId: string },
): Promise<void> {
  const { data: entries, error } = await admin
    .from("waitlist_entries")
    .update({ status: "removed_due_to_confirmed_reservation", removed_at: new Date().toISOString() })
    .eq("student_profile_id", params.studentProfileId)
    .in("status", ["active", "availability_notification_sent", "retention_check_sent"])
    .select("id");
  if (error) {
    console.error("[waitlist] removeWaitlistEntriesOnConfirmedReservation failed:", error);
    return;
  }
  for (const entry of entries ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "waitlist_entry_removed_confirmed_reservation",
      entityType: "waitlist_entries",
      entityId: entry.id,
      source: "system",
    });
  }
}
