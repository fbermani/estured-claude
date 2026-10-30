import type { AvailabilityMode, Residence, RoomTypeName } from "@/types/domain";
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

/** Barrios con al menos una residencia publicada (verified_active), ordenados; para el filtro de /search. */
export function barriosWithResidences(residences: Pick<Residence, "zone">[]): string[] {
  return [...new Set(residences.map((r) => r.zone).filter((z) => z && z !== "CABA"))].sort((a, b) => a.localeCompare(b, "es"));
}

/* ------------------------------------------------------------------------------------------------
 * Filtros de /search estilo Booking (rediseño 2026-10-29, propuesta B). Todo vive en query params
 * (URL compartible) y se resuelve en el servidor; los contadores se calculan sobre el catálogo real.
 * Supuestos reversibles: solo hay filtros con dato real hoy. No existen en `Residence` el tipo de
 * convivencia (género) ni coordenadas, así que no hay filtro de género ni mapa.
 * ---------------------------------------------------------------------------------------------- */


export const ROOM_TYPE_FILTER_OPTIONS: RoomTypeName[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];
/** Modos de disponibilidad filtrables (los pausados son por tipo de habitación, no por residencia). */
export const STATUS_FILTER_OPTIONS: AvailabilityMode[] = ["real_by_place", "by_room_type_to_confirm", "not_updated", "full"];
export type SortKey = "rec" | "pa" | "pd";

export type SearchFilters = {
  barrio: string[];
  uni: string[];
  room: string[];
  services: string[];
  areas: string[];
  status: string[];
  promo: boolean;
  minor: boolean;
  /** Presupuesto en USD sobre el precio «desde» mostrado; `null` = sin extremo. */
  pmin: number | null;
  pmax: number | null;
  sort: SortKey;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;
export type FilterGroupKey = "barrio" | "uni" | "room" | "services" | "areas" | "status";
/** Nombre del query param de cada grupo. */
export const PARAM_NAMES: Record<FilterGroupKey, string> = {
  barrio: "barrio",
  uni: "uni",
  room: "hab",
  services: "servicios",
  areas: "areas",
  status: "estado",
};

const csv = (raw: string | string[] | undefined): string[] =>
  (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",").map((v) => v.trim()).filter(Boolean);
const uniq = <T,>(list: T[]) => [...new Set(list)];
const toPrice = (raw: string | string[] | undefined): number | null => {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
};

/** Valores permitidos por grupo, derivados del catálogo actual (lo que no existe se descarta). */
export type FilterUniverse = {
  barrios: string[];
  unis: string[];
  extraServices: string[];
  extraAreas: string[];
};

export function buildUniverse(residences: Pick<Residence, "zone" | "nearUniversities" | "services" | "commonAreas">[]): FilterUniverse {
  const custom = customAmenityOptions(residences);
  const byName = (a: string, b: string) => a.localeCompare(b, "es");
  return {
    barrios: barriosWithResidences(residences),
    unis: uniq(residences.flatMap((r) => r.nearUniversities)).sort(byName),
    extraServices: custom.services,
    extraAreas: custom.areas,
  };
}

export function parseSearchFilters(params: SearchParamsInput, universe: FilterUniverse): SearchFilters {
  const only = (key: FilterGroupKey, allowed: readonly string[]) => uniq(csv(params[PARAM_NAMES[key]]).filter((v) => allowed.includes(v)));
  let pmin = toPrice(params.min);
  let pmax = toPrice(params.max);
  if (pmin !== null && pmax !== null && pmin > pmax) [pmin, pmax] = [pmax, pmin];
  const sortRaw = Array.isArray(params.orden) ? params.orden[0] : params.orden;
  return {
    barrio: only("barrio", universe.barrios),
    uni: only("uni", universe.unis),
    room: only("room", ROOM_TYPE_FILTER_OPTIONS),
    services: parseServiceFilter(params.servicios, universe.extraServices),
    areas: parseAreaFilter(params.areas, universe.extraAreas),
    status: only("status", STATUS_FILTER_OPTIONS),
    promo: params.promo === "1",
    minor: params.menores === "1",
    pmin,
    pmax,
    sort: sortRaw === "pa" || sortRaw === "pd" ? sortRaw : "rec",
  };
}

type Matchable = Pick<Residence, "zone" | "nearUniversities" | "roomTypes" | "services" | "commonAreas" | "availabilityMode" | "priceFromUsd" | "promotionPercent" | "acceptsMinors">;

/** `skip` ignora un grupo (para contadores y para el rango de precios). Dentro de un grupo: «alguno»; servicios y áreas: «todos». */
export function matchesFilters(r: Matchable, f: SearchFilters, skip?: FilterGroupKey | "price" | "promo" | "minor"): boolean {
  const any = (sel: string[], test: (v: string) => boolean) => sel.length === 0 || sel.some(test);
  return (
    (skip === "barrio" || any(f.barrio, (v) => r.zone === v)) &&
    (skip === "uni" || any(f.uni, (v) => r.nearUniversities.includes(v))) &&
    (skip === "room" || any(f.room, (v) => r.roomTypes.some((rt) => rt.type === v))) &&
    (skip === "services" || f.services.every((v) => r.services.includes(v))) &&
    (skip === "areas" || f.areas.every((v) => (r.commonAreas ?? []).includes(v))) &&
    (skip === "status" || any(f.status, (v) => r.availabilityMode === v)) &&
    (skip === "promo" || !f.promo || (r.promotionPercent ?? 0) > 0) &&
    (skip === "minor" || !f.minor || r.acceptsMinors === true) &&
    (skip === "price" || ((f.pmin === null || r.priceFromUsd >= f.pmin) && (f.pmax === null || r.priceFromUsd <= f.pmax)))
  );
}

export function applySearchFilters<T extends Matchable>(list: T[], f: SearchFilters): T[] {
  const out = list.filter((r) => matchesFilters(r, f));
  if (f.sort === "pa") return out.sort((a, b) => a.priceFromUsd - b.priceFromUsd);
  if (f.sort === "pd") return out.sort((a, b) => b.priceFromUsd - a.priceFromUsd);
  return out;
}

/** Contador de una opción: cuántas residencias quedarían con SOLO esa opción en su grupo y el resto de filtros activos. */
export function countOption(list: Matchable[], f: SearchFilters, key: FilterGroupKey, value: string): number {
  // Servicios y áreas son «todos»: la opción se suma a lo ya elegido; en el resto de los grupos es «alguno» y se evalúa sola.
  const all = key === "services" || key === "areas";
  const probe = { ...f, [key]: all ? uniq([...f[key], value]) : [value] } as SearchFilters;
  return list.filter((r) => matchesFilters(r, probe)).length;
}

/** Contador de un interruptor (promoción / menores): cuántas quedarían al activarlo. */
export function countToggle(list: Matchable[], f: SearchFilters, key: "promo" | "minor"): number {
  const probe = { ...f, [key]: true };
  return list.filter((r) => matchesFilters(r, probe)).length;
}

/** Contadores de todas las opciones de los grupos, calculados en el servidor: `counts[grupo][valor]`. */
export function buildCounts(list: Matchable[], f: SearchFilters, options: Record<FilterGroupKey, string[]>) {
  const counts = {} as Record<FilterGroupKey, Record<string, number>>;
  for (const key of Object.keys(options) as FilterGroupKey[]) {
    counts[key] = Object.fromEntries(options[key].map((v) => [v, countOption(list, f, key, v)]));
  }
  return { counts, promo: countToggle(list, f, "promo"), minor: countToggle(list, f, "minor") };
}

/** Límites del control de presupuesto (múltiplos de 10 que cubren el catálogo). */
export function priceBounds(list: Pick<Residence, "priceFromUsd">[]): { min: number; max: number } {
  const prices = list.map((r) => r.priceFromUsd).filter((p) => p > 0);
  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.floor(Math.min(...prices) / 10) * 10, max: Math.ceil(Math.max(...prices) / 10) * 10 };
}

export function countActiveFilters(f: SearchFilters): number {
  return f.barrio.length + f.uni.length + f.room.length + f.services.length + f.areas.length + f.status.length + (f.promo ? 1 : 0) + (f.minor ? 1 : 0) + (f.pmin !== null || f.pmax !== null ? 1 : 0);
}
