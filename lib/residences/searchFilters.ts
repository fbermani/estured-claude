import type { Residence } from "@/types/domain";
import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS } from "@/lib/residences/options";

/**
 * Filtros de /search por servicios y áreas comunes (DR18): query params `servicios` y `areas` (valores separados por coma).
 * Se filtra en el servidor; los valores se validan contra las listas que elige la residencia en su ficha (lo demás se descarta).
 */
const SERVICES = new Set<string>(SERVICE_OPTIONS);
const AREAS = new Set<string>(COMMON_AREA_OPTIONS);

function parseList(raw: string | string[] | undefined, allowed: Set<string>, extra: readonly string[]): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [...new Set(text.split(",").map((v) => v.trim()).filter((v) => allowed.has(v) || extra.includes(v)))];
}

/** `extra` = ítems «Otro» aprobados que hoy tiene el catálogo (ver `customAmenityOptions`): también se pueden filtrar. */
export function parseServiceFilter(raw: string | string[] | undefined, extra: readonly string[] = []): string[] {
  return parseList(raw, SERVICES, extra);
}

export function parseAreaFilter(raw: string | string[] | undefined, extra: readonly string[] = []): string[] {
  return parseList(raw, AREAS, extra);
}

/**
 * Ítems «Otro» ya aprobados que hay en el catálogo (DR18 t4): servicios y áreas que no están en las listas fijas, ordenados.
 * Como el catálogo solo trae ítems aprobados, un pendiente o rechazado nunca aparece como opción de filtro.
 */
export function customAmenityOptions(residences: Pick<Residence, "services" | "commonAreas">[]): { services: string[]; areas: string[] } {
  const uniq = (list: string[]) => [...new Set(list)].sort((a, b) => a.localeCompare(b, "es"));
  return {
    services: uniq(residences.flatMap((r) => r.services).filter((v) => !SERVICES.has(v))),
    areas: uniq(residences.flatMap((r) => r.commonAreas ?? []).filter((v) => !AREAS.has(v))),
  };
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
