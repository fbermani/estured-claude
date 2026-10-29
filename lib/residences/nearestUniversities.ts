import { findUniversitiesByName, haversineDistanceKm } from "@/lib/data/buenosAiresUniversities";

/** La tarjeta del catálogo muestra solo las N sedes más cercanas; el resto se ve en la ficha. */
export const CARD_MAX_UNIVERSITIES = 3;

/**
 * Las `limit` sedes más cercanas a la residencia (línea recta). Orden estable: ante empate de distancia
 * se respeta el orden original; los nombres sin coordenada conocida van al final, también en orden original.
 * Fail-safe: sin ubicación o sin catálogo, devuelve las primeras `limit` en el orden recibido.
 */
export function nearestUniversityNames(
  names: string[],
  location: { lat: number; lng: number } | null | undefined,
  limit: number = CARD_MAX_UNIVERSITIES,
): string[] {
  const unique = [...new Set(names)];
  if (unique.length <= limit && !location) return unique;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return unique.slice(0, limit);
  const coords = new Map(findUniversitiesByName(unique).map((u) => [u.name, u]));
  return unique
    .map((name, index) => {
      const u = coords.get(name);
      const km = u ? haversineDistanceKm(location, u) : Number.POSITIVE_INFINITY;
      return { name, index, km: Number.isFinite(km) ? km : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => (a.km === b.km ? a.index - b.index : a.km - b.km))
    .slice(0, limit)
    .map((x) => x.name);
}
