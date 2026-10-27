import type { Residence } from "@/types/domain";
import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS } from "@/lib/residences/options";

/**
 * Filtros de /search por servicios y áreas comunes (DR18): query params `servicios` y `areas` (valores separados por coma).
 * Se filtra en el servidor; los valores se validan contra las listas que elige la residencia en su ficha (lo demás se descarta).
 */
const SERVICES = new Set<string>(SERVICE_OPTIONS);
const AREAS = new Set<string>(COMMON_AREA_OPTIONS);

function parseList(raw: string | string[] | undefined, allowed: Set<string>): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [...new Set(text.split(",").map((v) => v.trim()).filter((v) => allowed.has(v)))];
}

export function parseServiceFilter(raw: string | string[] | undefined): string[] {
  return parseList(raw, SERVICES);
}

export function parseAreaFilter(raw: string | string[] | undefined): string[] {
  return parseList(raw, AREAS);
}

/** Una residencia pasa si ofrece TODOS los servicios y áreas pedidos. */
export function filterByAmenities(residences: Residence[], services: string[], areas: string[]): Residence[] {
  if (services.length === 0 && areas.length === 0) return residences;
  return residences.filter(
    (r) => services.every((s) => r.services.includes(s)) && areas.every((a) => (r.commonAreas ?? []).includes(a)),
  );
}

/** Barrios con al menos una residencia publicada (verified_active), ordenados; para el filtro de /search. */
export function barriosWithResidences(residences: Pick<Residence, "zone">[]): string[] {
  return [...new Set(residences.map((r) => r.zone).filter((z) => z && z !== "CABA"))].sort((a, b) => a.localeCompare(b, "es"));
}
