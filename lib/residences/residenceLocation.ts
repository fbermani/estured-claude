import "server-only";
import { getApproxZoneCoordinates } from "@/lib/data/caBarrioCentroids";

/**
 * Ubicación de una residencia para el mapa de la ficha. Decisión del dueño (2026-10-23, reemplaza DF3/DF4):
 * la dirección y la ubicación de una residencia son información PÚBLICA (cualquiera las encuentra online), así
 * que NO se ocultan ni se aproximan: el mapa muestra el pin exacto (`residences.latitude/longitude`, migración
 * 0042) y las universidades cercanas con su distancia en línea recta desde ese punto.
 *
 * Sin coordenada válida se cae al centro del barrio, marcado `source: "neighborhood"`: ahí NO se dibuja un pin
 * exacto y la UI dice "ubicación aproximada: barrio".
 */

export type ResidenceLocation = {
  lat: number;
  lng: number;
  /** `residence` = coordenada propia (pin exacto); `neighborhood` = centro del barrio (fallback, sin pin exacto). */
  source: "residence" | "neighborhood";
};

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inRange(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** `numeric(9,6)`: 6 decimales (~0,1 m). */
function toColumnPrecision(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

export type ParsedCoordinates =
  | { ok: true; lat: number; lng: number }
  | { ok: true; lat: null; lng: null }
  | { ok: false; error: string };

/**
 * Valida lo que carga el admin (texto del formulario). Ambos vacíos = quitar la coordenada (vuelve al centro
 * del barrio). Acepta coma decimal; devuelve con la precisión de la columna (6 decimales).
 */
export function parseCoordinates(latRaw: unknown, lngRaw: unknown): ParsedCoordinates {
  const latEmpty = latRaw === null || latRaw === undefined || String(latRaw).trim() === "";
  const lngEmpty = lngRaw === null || lngRaw === undefined || String(lngRaw).trim() === "";
  if (latEmpty && lngEmpty) return { ok: true, lat: null, lng: null };
  if (latEmpty || lngEmpty) return { ok: false, error: "Cargá latitud y longitud juntas, o dejá las dos vacías." };

  const lat = toFiniteNumber(latRaw);
  const lng = toFiniteNumber(lngRaw);
  if (lat === null || lng === null) {
    return { ok: false, error: "La latitud y la longitud tienen que ser números (ej.: -34.581234 y -58.421567)." };
  }
  if (lat < -90 || lat > 90) return { ok: false, error: "La latitud tiene que estar entre -90 y 90." };
  if (lng < -180 || lng > 180) return { ok: false, error: "La longitud tiene que estar entre -180 y 180." };
  return { ok: true, lat: toColumnPrecision(lat), lng: toColumnPrecision(lng) };
}

/**
 * Coordenada de la residencia, o el centro de su barrio como fallback. Acepta la fila de `residences`
 * (`numeric` puede llegar como número o string según el driver).
 */
export function getResidenceLocation(residence: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  public_area?: string | null;
}): ResidenceLocation {
  const lat = toFiniteNumber(residence.latitude);
  const lng = toFiniteNumber(residence.longitude);
  if (lat !== null && lng !== null && inRange(lat, lng)) {
    return { lat, lng, source: "residence" };
  }
  const center = getApproxZoneCoordinates(residence.public_area ?? "");
  return { lat: center.lat, lng: center.lng, source: "neighborhood" };
}
