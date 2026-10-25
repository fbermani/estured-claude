/**
 * Edad de residentes (DR14, docs/06 §8.1, docs/08 §4.4). Lógica pura, sin I/O.
 *
 * - La edad del estudiante se calcula con su fecha de nacimiento a una fecha de referencia
 *   (la fecha de ingreso solicitada; en la búsqueda, la del filtro o, si no hay, hoy).
 * - Sin fecha de nacimiento NO se excluye ninguna residencia.
 */

export const ADULT_AGE = 18;
export const MIN_ALLOWED_AGE = 10;
export const MAX_ALLOWED_AGE = 99;

export interface ResidenceAgeRule {
  minResidentAge: number | null | undefined;
  maxResidentAge: number | null | undefined;
  acceptsMinors: boolean | null | undefined;
}

/** `YYYY-MM-DD` válido como fecha de calendario, o null. */
function parseIsoDate(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Edad en años cumplidos de `birthDate` a `atDate` (ambas `YYYY-MM-DD`). Null si falta o es inválida la nacimiento, o si nació después de la fecha. */
export function ageAtDate(birthDate: string | null | undefined, atDate: string): number | null {
  const birth = parseIsoDate(birthDate);
  const at = parseIsoDate(atDate);
  if (!birth || !at) return null;
  let age = at.y - birth.y;
  if (at.m < birth.m || (at.m === birth.m && at.d < birth.d)) age -= 1;
  return age < 0 ? null : age;
}

export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Hoy como `YYYY-MM-DD` en hora de Buenos Aires (no UTC). */
export function todayIso(now: Date = new Date()): string {
  return now.toLocaleDateString("sv", { timeZone: APP_TIME_ZONE });
}

/** ¿La residencia admite a una persona de esa edad? `age = null` (sin fecha de nacimiento) nunca excluye. Sin reglas (null) = sin límites propios, piso 18. */
export function residenceAcceptsAge(rule: ResidenceAgeRule, age: number | null): boolean {
  if (age == null) return true;
  const min = rule.minResidentAge ?? ADULT_AGE;
  if (age < ADULT_AGE && !rule.acceptsMinors) return false;
  if (age < min) return false;
  if (rule.maxResidentAge != null && age > rule.maxResidentAge) return false;
  return true;
}

export type AgeRangeInput = { minAge: unknown; maxAge: unknown; acceptsMinors: unknown };
export type AgeRangeResult =
  | { ok: true; value: { minResidentAge: number; maxResidentAge: number | null; acceptsMinors: boolean } }
  | { ok: false; error: string };

function parseAgeNumber(raw: unknown): number | null | "invalid" {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n)) return "invalid";
  return n;
}

/** Validación server-side del rango de edad de la residencia (espeja los CHECKs de la migración 0052). */
export function validateAgeRange(input: AgeRangeInput): AgeRangeResult {
  const acceptsMinors = input.acceptsMinors === true || input.acceptsMinors === "true" || input.acceptsMinors === "on";
  const minParsed = parseAgeNumber(input.minAge);
  const maxParsed = parseAgeNumber(input.maxAge);
  if (minParsed === "invalid" || maxParsed === "invalid") return { ok: false, error: "La edad tiene que ser un número entero, sin decimales." };

  const min = minParsed ?? ADULT_AGE;
  if (min < MIN_ALLOWED_AGE || min > MAX_ALLOWED_AGE) return { ok: false, error: `La edad mínima tiene que estar entre ${MIN_ALLOWED_AGE} y ${MAX_ALLOWED_AGE} años.` };
  if (min < ADULT_AGE && !acceptsMinors)
    return { ok: false, error: "Para poner una edad mínima menor a 18 tenés que marcar que aceptás residentes menores de 18." };
  if (maxParsed != null) {
    if (maxParsed < ADULT_AGE || maxParsed > MAX_ALLOWED_AGE) return { ok: false, error: `La edad máxima tiene que estar entre ${ADULT_AGE} y ${MAX_ALLOWED_AGE} años, o dejala vacía si no tenés tope.` };
    if (maxParsed < min) return { ok: false, error: "La edad máxima no puede ser menor que la mínima." };
  }
  return { ok: true, value: { minResidentAge: min, maxResidentAge: maxParsed, acceptsMinors } };
}

/** Texto público del rango, p. ej. "Desde 18 años", "De 18 a 30 años". */
export function describeAgeRange(rule: ResidenceAgeRule): string {
  const min = rule.minResidentAge ?? ADULT_AGE;
  const max = rule.maxResidentAge ?? null;
  return max != null ? `De ${min} a ${max} años` : `Desde ${min} años`;
}
