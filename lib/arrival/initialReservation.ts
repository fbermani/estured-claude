import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El checklist «Antes de viajar» (DR29/DR35) es solo para la reserva INICIAL de un estudiante. Una reserva que nace de un
 * cambio de residencia (`stay_change_intents.resolved_reservation_id`) no lo lleva: la persona ya vive en Buenos Aires.
 * Las renovaciones no crean una reserva nueva (extienden la vigente), así que no hace falta contemplarlas acá.
 * Devuelve los ids, de los recibidos, que SON cambios de residencia. Si la consulta falla, se asume reserva inicial (se muestra el checklist).
 */
export async function loadStayChangeReservationIds(client: SupabaseClient, reservationIds: string[]): Promise<Set<string>> {
  if (reservationIds.length === 0) return new Set();
  const { data, error } = await client.from("stay_change_intents").select("resolved_reservation_id").in("resolved_reservation_id", reservationIds);
  if (error) {
    console.error("[arrival] no se pudo distinguir reservas iniciales de cambios de residencia:", error);
    return new Set();
  }
  return new Set(((data ?? []) as { resolved_reservation_id: string | null }[]).map((r) => r.resolved_reservation_id).filter((id): id is string => !!id));
}
