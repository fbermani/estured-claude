import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Estudiante "alojado" (docs/04 §7) = tiene una reserva confirmada.
 * Cliente RLS-scoped (`getSupabaseServer`) — sin filtro explícito de
 * estudiante porque la policy ya acota `reservations` al usuario actual.
 */
export async function getIsHoused(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("reservations").select("id").eq("status", "confirmed").maybeSingle();
  return !!data;
}
