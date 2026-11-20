import type { AvailabilityMode, Residence, RoomTypeName } from "@/types/domain";
import { COMMON_AREA_OPTIONS, SERVICE_OPTIONS } from "@/lib/residences/options";
import { amenityKey, dedupeAmenities } from "@/lib/residences/amenityKeys";

/**
 * Filtros de /search por servicios y áreas comunes (DR18): query params `servicios` y `areas` (valores separados por coma).
 * Se filtra en el servidor; los valores se validan contra las listas que elige la residencia en su ficha (lo demás se descarta).
 */
const SERVICE_KEYS = new Set<string>(SERVICE_OPTIONS.map(amenityKey));
const AREA_KEYS = new Set<string>(COMMON_AREA_OPTIONS.map(amenityKey));

/**
 * Valida una lista contra las opciones fijas de la ficha + los «Otro» aprobados del catálogo (`extra`), comparando por clave
 * (sin mayúsculas ni tildes). Devuelve la etiqueta canónica de cada opción, sin repetidos.
 */
function parseList(raw: string | string[] | undefined, fixed: readonly string[], fixedKeys: Set<string>, extra: readonly string[]): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const canonical = new Map<string, string>();
  for (const label of [...fixed, ...extra]) if (!canonical.has(amenityKey(label))) canonical.set(amenityKey(label), label);
  const extraKeys = new Set(extra.map(amenityKey));
  const picked = text
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v && (fixedKeys.has(amenityKey(v)) || extraKeys.has(amenityKey(v))))
    .map((v) => canonical.get(amenityKey(v)) as string);
  return [...new Set(picked)];
}

/** `extra` = ítems «Otro» aprobados que hoy tiene el catálogo (ver `customAmenityOptions`): también se pueden filtrar. */
export function parseServiceFilter(raw: string | string[] | undefined, extra: readonly string[] = []): string[] {
  return parseList(raw, SERVICE_OPTIONS, SERVICE_KEYS, extra);
}

export function parseAreaFilter(raw: string | string[] | undefined, extra: readonly string[] = []): string[] {
  // Lo que `areaFilterOptions` oculta (ítems que ya son servicio) tampoco se acepta por URL.
  return parseList(raw, COMMON_AREA_OPTIONS, AREA_KEYS, extra).filter((l) => !SERVICE_KEYS.has(amenityKey(l)));
}

/**
 * Ítems «Otro» ya aprobados que hay en el catálogo (DR18 t4): servicios y áreas que no están en las listas fijas, ordenados.
 * Como el catálogo solo trae ítems aprobados, un pendiente o rechazado nunca aparece como opción de filtro.
 * Se deduplican por clave (minúsculas, sin tildes, equivalencias de `amenityKey`) y entre grupos: un ítem que ya es una opción
 * fija («Cocina», «Gimnasio») no se repite, y uno que aparece en ambos grupos queda en el que más lo usa (empate: servicios).
 */
export function customAmenityOptions(residences: Pick<Residence, "services" | "commonAreas">[]): { services: string[]; areas: string[] } {
  const fixed = new Set([...SERVICE_KEYS, ...AREA_KEYS]);
  type Entry = { service: number; area: number; labels: Map<string, number> };
  const byKey = new Map<string, Entry>();
  const add = (label: string, group: "service" | "area") => {
    const k = amenityKey(label);
    if (fixed.has(k)) return;
    const e = byKey.get(k) ?? { service: 0, area: 0, labels: new Map() };
    e[group] += 1;
    e.labels.set(label.trim(), (e.labels.get(label.trim()) ?? 0) + 1);
    byKey.set(k, e);
  };
  for (const r of residences) {
    r.services.forEach((v) => add(v, "service"));
    (r.commonAreas ?? []).forEach((v) => add(v, "area"));
  }
  const out = { services: [] as string[], areas: [] as string[] };
  for (const e of byKey.values()) {
    // Etiqueta: la variante más usada; empate, la primera que apareció en el catálogo.
    const label = [...e.labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
    (e.area > e.service ? out.areas : out.services).push(label);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, "es");
  return { services: out.services.sort(byName), areas: out.areas.sort(byName) };
}

/** Opciones del grupo «Servicios»: las fijas + los «Otro» aprobados, sin repetidos. */
export function serviceFilterOptions(extra: readonly string[]): string[] {
  return dedupeAmenities([...SERVICE_OPTIONS, ...extra]);
}

/** Opciones del grupo «Áreas comunes»: sin repetidos y sin lo que ya vive en «Servicios». */
export function areaFilterOptions(extra: readonly string[]): string[] {
  return dedupeAmenities([...COMMON_AREA_OPTIONS, ...extra]).filter((l) => !SERVICE_KEYS.has(amenityKey(l)));
}

/** Claves de todo lo que ofrece una residencia (servicios + áreas): un ítem se encuentra esté donde esté cargado. */
function offeredKeys(r: Pick<Residence, "services" | "commonAreas">): Set<string> {
  return new Set([...r.services, ...(r.commonAreas ?? [])].map(amenityKey));
}

/** Barrios con al menos una residencia publicada (verified_active), ordenados; para el filtro de /search. */
export function barriosWithResidences(residences: Pick<Residence, "zone">[]): string[] {
  return [...new Set(residences.map((r) => r.zone).filter((z) => z && z !== "CABA"))].sort((a, b) => a.localeCompare(b, "es"));
}

/* ------------------------------------------------------------------------------------------------
 * Filtros de /search estilo Booking (rediseño 2026-10-29, propuesta B). Todo vive en query params
 * (URL compartible) y se resuelve en el servidor; los contadores se calculan sobre el catálogo real.
 * Género (`genero`): sale de `Residence.genderPolicy`; las residencias que no la declaran no
 * coinciden con ningún género. La vista (`vista`) y el mapa usan las coordenadas públicas de la residencia.
 * ---------------------------------------------------------------------------------------------- */


export const ROOM_TYPE_FILTER_OPTIONS: RoomTypeName[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];
/** Modos de disponibilidad filtrables (los pausados son por tipo de habitación, no por residencia). */
export const STATUS_FILTER_OPTIONS: AvailabilityMode[] = ["real_by_place", "by_room_type_to_confirm", "not_updated", "full"];
export type SortKey = "rec" | "pa" | "pd";
export type ViewMode = "lista" | "grilla" | "mapa";
export type GenderPolicy = NonNullable<Residence["genderPolicy"]>;
export const GENDER_FILTER_OPTIONS: GenderPolicy[] = ["mixto", "solo_mujeres", "solo_hombres"];
export const GENDER_LABELS: Record<GenderPolicy, string> = { mixto: "Mixto", solo_mujeres: "Solo mujeres", solo_hombres: "Solo hombres" };

export type SearchFilters = {
  barrio: string[];
  uni: string[];
  room: string[];
  services: string[];
  areas: string[];
  status: string[];
  gender: string[];
  promo: boolean;
  minor: boolean;
  /** Solo residencias con comunidad activa (residentes visibles, que solo muestran las Premium). */
  community: boolean;
  /** Presupuesto en USD sobre el precio «desde» mostrado; `null` = sin extremo. */
  pmin: number | null;
  pmax: number | null;
  sort: SortKey;
  view: ViewMode;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;
export type FilterGroupKey = "barrio" | "uni" | "room" | "services" | "areas" | "gender" | "status";
/** Nombre del query param de cada grupo. */
export const PARAM_NAMES: Record<FilterGroupKey, string> = {
  barrio: "barrio",
  uni: "uni",
  room: "hab",
  services: "servicios",
  areas: "areas",
  gender: "genero",
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
  const viewRaw = Array.isArray(params.vista) ? params.vista[0] : params.vista;
  return {
    barrio: only("barrio", universe.barrios),
    uni: only("uni", universe.unis),
    room: only("room", ROOM_TYPE_FILTER_OPTIONS),
    services: parseServiceFilter(params.servicios, universe.extraServices),
    areas: parseAreaFilter(params.areas, universe.extraAreas),
    status: only("status", STATUS_FILTER_OPTIONS),
    gender: only("gender", GENDER_FILTER_OPTIONS),
    promo: params.promo === "1",
    minor: params.menores === "1",
    community: params.comunidad === "1",
    pmin,
    pmax,
    sort: sortRaw === "pa" || sortRaw === "pd" ? sortRaw : "rec",
    view: viewRaw === "lista" || viewRaw === "mapa" ? viewRaw : "grilla",
  };
}

type Matchable = Pick<Residence, "zone" | "nearUniversities" | "roomTypes" | "services" | "commonAreas" | "availabilityMode" | "priceFromUsd" | "promotionPercent" | "acceptsMinors" | "residentsCount" | "genderPolicy" | "genderPolicies">;

/** `skip` ignora un grupo (para contadores y para el rango de precios). Dentro de un grupo: «alguno»; servicios y áreas: «todos». */
export function matchesFilters(r: Matchable, f: SearchFilters, skip?: FilterGroupKey | "price" | "promo" | "minor" | "community"): boolean {
  const any = (sel: string[], test: (v: string) => boolean) => sel.length === 0 || sel.some(test);
  const hasAll = (sel: string[]) => {
    if (sel.length === 0) return true;
    const keys = offeredKeys(r);
    return sel.every((v) => keys.has(amenityKey(v)));
  };
  return (
    (skip === "barrio" || any(f.barrio, (v) => r.zone === v)) &&
    (skip === "uni" || any(f.uni, (v) => r.nearUniversities.includes(v))) &&
    (skip === "room" || any(f.room, (v) => r.roomTypes.some((rt) => rt.type === v))) &&
    (skip === "services" || hasAll(f.services)) &&
    (skip === "areas" || hasAll(f.areas)) &&
    (skip === "gender" || any(f.gender, (v) => (r.genderPolicies ?? (r.genderPolicy ? [r.genderPolicy] : [])).includes(v as GenderPolicy))) &&
    (skip === "status" || any(f.status, (v) => r.availabilityMode === v)) &&
    (skip === "promo" || !f.promo || (r.promotionPercent ?? 0) > 0) &&
    (skip === "minor" || !f.minor || r.acceptsMinors === true) &&
    (skip === "community" || !f.community || (r.residentsCount ?? 0) > 0) &&
    (skip === "price" || ((f.pmin === null || r.priceFromUsd >= f.pmin) && (f.pmax === null || r.priceFromUsd <= f.pmax)))
  );
}

/**
 * DR24: grupo del orden «Recomendado». Usa solo el `availabilityMode` ya calculado
 * (el mismo que muestra StatusTag); no infiere cupos.
 */
export function recommendedGroup(mode: AvailabilityMode): 1 | 2 | 3 {
  if (mode === "real_by_place" || mode === "by_room_type_to_confirm") return 1;
  if (mode === "not_updated") return 2;
  return 3; // full, paused_by_residence, paused_by_admin
}

/**
 * DR49: residencias que EstuRed opera o co-gestiona. No aparecen ocultas ni marcadas, pero quedan al final del orden
 * «Recomendado» (en el resto de los órdenes y filtros se tratan igual que cualquier otra). Se identifican por slug.
 */
export const EXCLUDED_FROM_RECOMMENDED_SLUGS: readonly string[] = ["residencia-sin-fronteras-29fefe"];

/**
 * DR24: «disponibles primero». Orden estable: dentro de cada grupo se conserva el orden
 * de entrada, que el catálogo entrega por created_at desc (más recientes primero). No oculta nada.
 * DR49: las residencias de `EXCLUDED_FROM_RECOMMENDED_SLUGS` van después de todas las demás.
 */
export function sortRecommended<T extends { availabilityMode: AvailabilityMode; slug?: string }>(list: T[]): T[] {
  const excluded = (r: T) => (r.slug && EXCLUDED_FROM_RECOMMENDED_SLUGS.includes(r.slug) ? 1 : 0);
  return [...list].sort((a, b) => excluded(a) - excluded(b) || recommendedGroup(a.availabilityMode) - recommendedGroup(b.availabilityMode));
}

export function applySearchFilters<T extends Matchable>(list: T[], f: SearchFilters): T[] {
  const out = list.filter((r) => matchesFilters(r, f));
  if (f.sort === "pa") return out.sort((a, b) => a.priceFromUsd - b.priceFromUsd);
  if (f.sort === "pd") return out.sort((a, b) => b.priceFromUsd - a.priceFromUsd);
  return sortRecommended(out);
}

/** Contador de una opción: cuántas residencias quedarían con SOLO esa opción en su grupo y el resto de filtros activos. */
export function countOption(list: Matchable[], f: SearchFilters, key: FilterGroupKey, value: string): number {
  // Servicios y áreas son «todos»: la opción se suma a lo ya elegido; en el resto de los grupos es «alguno» y se evalúa sola.
  const all = key === "services" || key === "areas";
  const probe = { ...f, [key]: all ? uniq([...f[key], value]) : [value] } as SearchFilters;
  return list.filter((r) => matchesFilters(r, probe)).length;
}

/** Contador de un interruptor (promoción / menores): cuántas quedarían al activarlo. */
export function countToggle(list: Matchable[], f: SearchFilters, key: "promo" | "minor" | "community"): number {
  const probe = { ...f, [key]: true };
  return list.filter((r) => matchesFilters(r, probe)).length;
}

/** Contadores de todas las opciones de los grupos, calculados en el servidor: `counts[grupo][valor]`. */
export function buildCounts(list: Matchable[], f: SearchFilters, options: Record<FilterGroupKey, string[]>) {
  const counts = {} as Record<FilterGroupKey, Record<string, number>>;
  for (const key of Object.keys(options) as FilterGroupKey[]) {
    counts[key] = Object.fromEntries(options[key].map((v) => [v, countOption(list, f, key, v)]));
  }
  return { counts, promo: countToggle(list, f, "promo"), minor: countToggle(list, f, "minor"), community: countToggle(list, f, "community") };
}

/** Límites del control de presupuesto (múltiplos de 10 que cubren el catálogo). */
export function priceBounds(list: Pick<Residence, "priceFromUsd">[]): { min: number; max: number } {
  const prices = list.map((r) => r.priceFromUsd).filter((p) => p > 0);
  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.floor(Math.min(...prices) / 10) * 10, max: Math.ceil(Math.max(...prices) / 10) * 10 };
}

/** Histograma del control de presupuesto: cuántas residencias caen en cada tramo, con todos los filtros salvo el precio. */
export function priceHistogram(list: Matchable[], f: SearchFilters, bounds: { min: number; max: number }, bins = 15): number[] {
  const counts = Array.from({ length: bins }, () => 0);
  const span = bounds.max - bounds.min;
  if (span <= 0) return counts;
  for (const r of list) {
    if (!matchesFilters(r, f, "price")) continue;
    const i = Math.min(bins - 1, Math.max(0, Math.floor(((r.priceFromUsd - bounds.min) / span) * bins)));
    counts[i] += 1;
  }
  return counts;
}

export function countActiveFilters(f: SearchFilters): number {
  return f.barrio.length + f.uni.length + f.room.length + f.services.length + f.areas.length + f.status.length + f.gender.length + (f.promo ? 1 : 0) + (f.minor ? 1 : 0) + (f.community ? 1 : 0) + (f.pmin !== null || f.pmax !== null ? 1 : 0);
}

/**
 * Serializa los filtros a query string (mismos nombres que lee `parseSearchFilters`). Sirve para armar enlaces del
 * servidor, p. ej. las sugerencias del estado «sin resultados». Los valores por defecto no se escriben.
 */
export function filtersToQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  for (const key of Object.keys(PARAM_NAMES) as FilterGroupKey[]) if (f[key].length > 0) p.set(PARAM_NAMES[key], f[key].join(","));
  if (f.promo) p.set("promo", "1");
  if (f.minor) p.set("menores", "1");
  if (f.community) p.set("comunidad", "1");
  if (f.pmin !== null) p.set("min", String(f.pmin));
  if (f.pmax !== null) p.set("max", String(f.pmax));
  if (f.sort !== "rec") p.set("orden", f.sort);
  if (f.view !== "grilla") p.set("vista", f.view);
  return p.toString();
}

/** Cada filtro activo como una pieza que se puede quitar: devuelve los filtros sin ella. */
export function removableFilters(f: SearchFilters): { key: string; group: FilterGroupKey | "promo" | "minor" | "community" | "price"; value?: string; without: SearchFilters }[] {
  const out: ReturnType<typeof removableFilters> = [];
  for (const group of Object.keys(PARAM_NAMES) as FilterGroupKey[]) {
    for (const value of f[group]) out.push({ key: `${group}:${value}`, group, value, without: { ...f, [group]: f[group].filter((v) => v !== value) } });
  }
  if (f.promo) out.push({ key: "promo", group: "promo", without: { ...f, promo: false } });
  if (f.minor) out.push({ key: "minor", group: "minor", without: { ...f, minor: false } });
  if (f.community) out.push({ key: "community", group: "community", without: { ...f, community: false } });
  if (f.pmin !== null || f.pmax !== null) out.push({ key: "price", group: "price", without: { ...f, pmin: null, pmax: null } });
  return out;
}
