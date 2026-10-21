import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Disponibilidad vencida por residencia (auditoría 2026-10-20, H23).
 *
 * Solo LEE lo que ya calculan los jobs (`checkStaleAvailability`): un tipo
 * de habitación `not_updated` lleva más de 30 días sin actualizarse; uno con
 * `hidden_from_search_at` ya salió de las búsquedas (15 días después). No
 * recalcula plazos: es para avisar al owner/staff y al admin.
 */
export type StaleAvailability = {
  /** Tipos de habitación ya ocultos de las búsquedas. */
  hidden: number;
  /** Tipos "sin actualizar" que todavía se ven pero están por ocultarse. */
  notUpdated: number;
};

export async function getStaleAvailabilityByResidence(
  admin: SupabaseClient,
  residenceIds?: string[],
): Promise<Map<string, StaleAvailability>> {
  const result = new Map<string, StaleAvailability>();
  if (residenceIds && residenceIds.length === 0) return result;

  let query = admin
    .from("profile_availability")
    .select("residence_id, status, hidden_from_search_at, room_types!inner(is_active), residences!inner(status)")
    .eq("room_types.is_active", true)
    .eq("residences.status", "verified_active")
    .or("hidden_from_search_at.not.is.null,status.eq.not_updated");
  if (residenceIds) query = query.in("residence_id", residenceIds);

  const { data, error } = await query;
  if (error) {
    console.error("[staleAvailability] query failed:", error);
    return result;
  }

  for (const row of data ?? []) {
    const entry = result.get(row.residence_id as string) ?? { hidden: 0, notUpdated: 0 };
    if (row.hidden_from_search_at) entry.hidden += 1;
    else entry.notUpdated += 1;
    result.set(row.residence_id as string, entry);
  }
  return result;
}

/** Texto único para el aviso (Panel, tarjeta del dashboard). `null` si no hay nada para avisar. */
export function staleAvailabilityMessage(stale: StaleAvailability | undefined): string | null {
  if (!stale) return null;
  const types = (n: number) => `${n} ${n === 1 ? "tipo de habitación" : "tipos de habitación"}`;
  if (stale.hidden > 0) {
    const base = `${types(stale.hidden)} ${stale.hidden === 1 ? "está oculto" : "están ocultos"} de las búsquedas por falta de actualización.`;
    const extra =
      stale.notUpdated > 0
        ? ` Otros ${stale.notUpdated} llevan más de 30 días sin actualizarse y van por el mismo camino.`
        : "";
    return `${base}${extra} Actualizá tu disponibilidad para que vuelvan a verse.`;
  }
  if (stale.notUpdated > 0) {
    return `${types(stale.notUpdated)} ${stale.notUpdated === 1 ? "lleva" : "llevan"} más de 30 días sin actualizar. Si no lo actualizás, ${stale.notUpdated === 1 ? "deja" : "dejan"} de aparecer en las búsquedas.`;
  }
  return null;
}
