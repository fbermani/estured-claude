import "server-only";

/**
 * Geocodificador de direcciones (DF6, docs/00 §31). Nominatim/OSM: gratis, sin clave, máx. 1 req/s y
 * `User-Agent` propio. Nunca lanza: ante cualquier falla devuelve `null` y el llamador degrada al centro del barrio.
 */
export type GeocodeQuery = { addressLine: string; zone?: string | null; city?: string | null };
export type GeocodeResult = { lat: number; lng: number };
export type Geocoder = (query: GeocodeQuery) => Promise<GeocodeResult | null>;

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 6000;
// Caja de CABA y alrededores: descarta resultados de otro país/ciudad con calles homónimas.
const VIEWBOX = "-58.55,-34.50,-58.33,-34.72";

export function buildNominatimUrl(query: GeocodeQuery): string {
  const q = [query.addressLine.trim(), query.zone?.trim(), query.city?.trim() || "Ciudad Autónoma de Buenos Aires", "Argentina"]
    .filter(Boolean)
    .join(", ");
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "ar", viewbox: VIEWBOX, bounded: "1" });
  return `${ENDPOINT}?${params.toString()}`;
}

export const geocodeAddress: Geocoder = async (query) => {
  if (!query.addressLine.trim()) return null;
  try {
    const res = await fetch(buildNominatimUrl(query), {
      headers: { "User-Agent": process.env.GEOCODER_USER_AGENT?.trim() || "EstuRed/1.0 (geocoder)", "Accept-Language": "es" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = Array.isArray(rows) ? rows[0] : undefined;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!first || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (error) {
    console.error("[geocoding] Nominatim falló:", error);
    return null;
  }
};
