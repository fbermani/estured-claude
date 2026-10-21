import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Estudiante "alojado" (docs/04 §7) = tiene una reserva confirmada.
 * Cliente RLS-scoped (`getSupabaseServer`) — sin filtro explícito de
 * estudiante porque la policy ya acota `reservations` al usuario actual.
 */
export async function getIsHoused(supabase: SupabaseClient): Promise<boolean> {
  // count + head: tolera más de una reserva confirmada (p. ej. renovaciones de datos viejos o reservas
  // visibles por vínculo familiar) sin caer en el PGRST116 de .maybeSingle().
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed");
  if (error) console.error("[students] getIsHoused failed:", error);
  return (count ?? 0) > 0;
}
