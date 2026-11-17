/**
 * Edad de los residentes en la ficha: el rango que admite la residencia (dato público de su perfil, migración 0052) y la edad
 * promedio de la comunidad vigente. Lógica pura: la franja «Lo esencial» y el capítulo «La comunidad» leen de acá para decir lo mismo.
 *
 * Privacidad: el promedio ya llega filtrado por `loadAverageResidentAge` (solo con comunidad activa y más de 10 edades válidas, nunca
 * una fecha individual); esta función no lo calcula ni lo relaja. Sin dato, no hay texto.
 */
import { describeAgeRange } from "@/lib/residences/age";

export type AgeInput = {
  /** `undefined` = la migración 0052 no está aplicada: no hay dato de rango. */
  minAge: number | null | undefined;
  maxAge: number | null | undefined;
  acceptsMinors: boolean | null | undefined;
  /** Promedio de la comunidad (ya filtrado por privacidad) o `null`. */
  average: { years: number; residents: number } | null;
};

export type AgeFacts = {
  /** «De 18 a 30 años» / «Desde 18 años»; `null` si no hay dato de rango. */
  rangeLabel: string | null;
  /** El rango tiene un tope: dice algo más que «mayores de 18». */
  hasCap: boolean;
  average: { years: number; residents: number } | null;
  /** Celda de la franja «Lo esencial»; `null` si no hay nada útil que mostrar. */
  strip: { value: string; unit: string; sub?: string } | null;
};

export function buildAgeFacts(input: AgeInput): AgeFacts {
  const hasRange = input.minAge !== undefined;
  const rangeLabel = hasRange
    ? describeAgeRange({ minResidentAge: input.minAge, maxResidentAge: input.maxAge, acceptsMinors: input.acceptsMinors })
    : null;
  const max = input.maxAge ?? null;
  const hasCap = hasRange && max != null;
  const min = input.minAge ?? 18;
  const average = input.average;

  let strip: AgeFacts["strip"] = null;
  if (hasCap) {
    strip = { value: `${min} a ${max}`, unit: "años", ...(average ? { sub: `promedio ${average.years} años` } : {}) };
  } else if (average) {
    strip = { value: String(average.years), unit: "años", sub: "edad promedio" };
  }
  return { rangeLabel, hasCap, average, strip };
}
