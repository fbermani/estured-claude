import { findUniversitiesByName, haversineDistanceKm } from "@/lib/data/buenosAiresUniversities";

/** ~1 cuadra = 100 m. Se recomienda elegir sedes a no más de 15 cuadras (≈1,5 km). */
export const RECOMMENDED_MAX_BLOCKS = 15;
/** Más de 20 cuadras (≈2 km): se avisa al admin (no bloquea ni oculta la sede). Auditoría del Owner, DR18. */
export const ALERT_THRESHOLD_KM = 2;

export type FarUniversity = { name: string; distanceKm: number };

/**
 * Sedes elegidas que quedan a más de 2 km (≈20 cuadras) en línea recta de la residencia. Solo para alertar al admin:
 * la sede se guarda y se muestra igual. Los nombres que no están en el catálogo se ignoran.
 */
export function findFarUniversities(
  residence: { lat: number; lng: number },
  universityNames: string[],
  thresholdKm: number = ALERT_THRESHOLD_KM,
): FarUniversity[] {
  return findUniversitiesByName(universityNames)
    .map((u) => ({ name: u.name, distanceKm: haversineDistanceKm(residence, u) }))
    .filter((u) => u.distanceKm > thresholdKm)
    .sort((a, b) => b.distanceKm - a.distanceKm);
}

/** Las sedes lejanas que NO estaban ya alertadas (para no repetir el aviso en cada guardado). */
export function newlyFarUniversities(current: FarUniversity[], previous: FarUniversity[]): FarUniversity[] {
  const before = new Set(previous.map((u) => u.name));
  return current.filter((u) => !before.has(u.name));
}
