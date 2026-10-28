/**
 * Ocupación y capacidad en ficha y tarjeta (DR18 fase 2, decisión 3 del Owner): «N plazas · M residentes», sin porcentaje ni
 * «quedan N». Es informativo, no una promesa de lugar (la disponibilidad vive solo en StatusTag).
 */

/** Plazas declaradas: por cada tipo, habitaciones activas × capacidad por habitación. */
export function computeCapacity(
  roomTypes: { id: string; capacity_per_room: number | null }[],
  rooms: { room_type_id: string }[],
): number {
  const capacityByType = new Map(roomTypes.map((t) => [t.id, Math.max(1, Math.floor(Number(t.capacity_per_room) || 1))]));
  let total = 0;
  for (const r of rooms) total += capacityByType.get(r.room_type_id) ?? 0;
  return total;
}

/** Residentes visibles: solo con Premium confirmado y al menos una estadía vigente. Plan ilegible o desconocido → null (fail-closed). */
export function residentsToDisplay(premium: boolean | null | undefined, count: number): number | null {
  return premium === true && count > 0 ? count : null;
}

/**
 * `capacity` null/0 → sin texto (no hay dato declarado). `residents` null → solo capacidad (Verificado o sin dato real).
 * Los residentes se muestran incluso si son 0 solo cuando hay dato real (Premium): «28 plazas · 0 residentes».
 */
export function formatOccupancy(capacity: number | null | undefined, residents: number | null | undefined): string | null {
  const cap = capacity != null && Number.isFinite(capacity) ? Math.floor(capacity) : 0;
  if (cap <= 0) return null;
  const plazas = `${cap} ${cap === 1 ? "plaza" : "plazas"}`;
  if (residents == null || !Number.isFinite(residents) || residents < 0) return plazas;
  const r = Math.floor(residents);
  return `${plazas} · ${r} ${r === 1 ? "residente" : "residentes"}`;
}
