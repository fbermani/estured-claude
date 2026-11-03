import { amenityKey } from "@/lib/residences/amenityKeys";
import { serviceLabel } from "@/lib/residences/options";

/**
 * Detalles de servicios/áreas con cantidad o frecuencia (migración 0073, `residences.amenity_details`, jsonb):
 *   { "kitchens": 2, "cleaning_general": { "mode": "daily" } | { "mode": "weekly", "per_week": 3 } }
 * Todo se valida acá (whitelist + rangos); lo que no calza se descarta. La columna puede no existir todavía: `undefined`/`null` = sin detalles.
 */
export const KITCHENS_MIN = 1;
export const KITCHENS_MAX = 5;
export const CLEANING_PER_WEEK_MIN = 1;
export const CLEANING_PER_WEEK_MAX = 6;

export const KITCHEN_AREA = "Cocina compartida";
export const CLEANING_SERVICE = "Limpieza General";

export type CleaningGeneral = { mode: "daily" } | { mode: "weekly"; perWeek: number };
export type AmenityDetails = { kitchens?: number; cleaningGeneral?: CleaningGeneral };

function intInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Lee el jsonb guardado (tolerante: cualquier cosa rara se ignora). */
export function parseAmenityDetails(raw: unknown): AmenityDetails {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: AmenityDetails = {};
  const k = intInRange(o.kitchens, KITCHENS_MIN, KITCHENS_MAX);
  if (k !== null) out.kitchens = k;
  const c = o.cleaning_general as Record<string, unknown> | undefined;
  if (c && typeof c === "object") {
    if (c.mode === "daily") out.cleaningGeneral = { mode: "daily" };
    else if (c.mode === "weekly") {
      const p = intInRange(c.per_week, CLEANING_PER_WEEK_MIN, CLEANING_PER_WEEK_MAX);
      if (p !== null) out.cleaningGeneral = { mode: "weekly", perWeek: p };
    }
  }
  return out;
}

/** Valida lo que manda el formulario y devuelve el jsonb a guardar; solo incluye lo que corresponde a ítems tildados. */
export function amenityDetailsFromForm(
  formData: FormData,
  selected: { services: readonly string[]; commonAreas: readonly string[] },
): { value: Record<string, unknown>; error: string | null } {
  const value: Record<string, unknown> = {};
  if (selected.commonAreas.includes(KITCHEN_AREA)) {
    const k = intInRange(formData.get("amenity_kitchens"), KITCHENS_MIN, KITCHENS_MAX);
    if (k === null) return { value, error: `Elegí cuántas cocinas compartidas tiene la residencia (de ${KITCHENS_MIN} a ${KITCHENS_MAX}).` };
    value.kitchens = k;
  }
  if (selected.services.includes(CLEANING_SERVICE)) {
    const mode = String(formData.get("amenity_cleaning_mode") ?? "");
    if (mode === "daily") value.cleaning_general = { mode: "daily" };
    else if (mode === "weekly") {
      const p = intInRange(formData.get("amenity_cleaning_per_week"), CLEANING_PER_WEEK_MIN, CLEANING_PER_WEEK_MAX);
      if (p === null) return { value, error: `Elegí cuántas veces por semana se hace la limpieza general (de ${CLEANING_PER_WEEK_MIN} a ${CLEANING_PER_WEEK_MAX}).` };
      value.cleaning_general = { mode: "weekly", per_week: p };
    } else return { value, error: "Elegí la frecuencia de la limpieza general: todos los días o algunas veces por semana." };
  }
  return { value, error: null };
}

export function cleaningFrequencyText(c: CleaningGeneral): string {
  if (c.mode === "daily") return "Todos los días";
  return c.perWeek === 1 ? "1 vez por semana" : `${c.perWeek} veces por semana`;
}

export function kitchensText(n: number): string {
  return n === 1 ? "1 cocina" : `${n} cocinas`;
}

/** Texto visible de un ítem: etiqueta + detalle si lo hay («Limpieza General · 3 veces por semana», «Cocina compartida · 2 cocinas»). */
export function amenityDisplayName(name: string, details?: AmenityDetails | null): string {
  const label = serviceLabel(name);
  const k = amenityKey(name);
  if (k === amenityKey(KITCHEN_AREA) && details?.kitchens) return `${label} · ${kitchensText(details.kitchens)}`;
  if (k === amenityKey(CLEANING_SERVICE) && details?.cleaningGeneral) return `${label} · ${cleaningFrequencyText(details.cleaningGeneral)}`;
  return label;
}

/**
 * Compatibilidad con filas anteriores a la migración 0073: «Gimnasio» ahora es un área común y «Cocina» (servicio) pasó a
 * «Cocina compartida» (área común). Mueve esos ítems de `services` a `commonAreas` y quita repetidos; idempotente.
 */
export function normalizeAmenityLists(input: { services: readonly string[]; commonAreas: readonly string[] }): { services: string[]; commonAreas: string[] } {
  const gym = amenityKey("Gimnasio");
  const kitchen = amenityKey(KITCHEN_AREA);
  const services: string[] = [];
  const areas: string[] = [...input.commonAreas];
  for (const s of input.services) {
    const k = amenityKey(s);
    if (k === gym) areas.push(s);
    else if (k === kitchen) areas.push(KITCHEN_AREA);
    else services.push(s);
  }
  const dedupe = (l: string[]) => {
    const seen = new Set<string>();
    return l.filter((x) => (seen.has(amenityKey(x)) ? false : (seen.add(amenityKey(x)), true)));
  };
  return { services: dedupe(services), commonAreas: dedupe(areas) };
}
