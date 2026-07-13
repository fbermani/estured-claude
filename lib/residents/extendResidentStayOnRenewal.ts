import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Docs/06 §14.2/§15.1, docs/04 §14 — "al confirmarse la renovación, el
 * sistema extiende `resident_stays.end_date` al fin del período
 * renovado". Deuda documentada desde el Ciclo 30 (`resident_stays` no
 * existía todavía) — se llama desde `confirmRenewalAfterFeePaid`. No
 * todas las reservas tienen una `resident_stays` cargada (es alta
 * manual de la residencia, docs/05 §15.1) así que un no-match es
 * normal, no un error. Nunca lanza — mismo criterio que
 * `removeWaitlistEntriesOnConfirmedReservation`.
 */
export async function extendResidentStayOnRenewal(
  admin: SupabaseClient,
  params: { reservationId: string; newEndDate: string },
): Promise<void> {
  try {
    const { data: stay, error } = await admin
      .from("resident_stays")
      .select("id")
      .eq("reservation_id", params.reservationId)
      .eq("is_current", true)
      .maybeSingle();
    if (error || !stay) return;

    await admin.from("resident_stays").update({ end_date: params.newEndDate }).eq("id", stay.id);
  } catch (error) {
    console.error("[residents] extendResidentStayOnRenewal failed:", error);
  }
}
