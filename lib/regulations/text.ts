import { createHash } from "node:crypto";
import { findPlaceholders } from "@/lib/regulations/modelTemplate";

/**
 * Texto del reglamento de la residencia (DR14, docs/06 §8.7): normalización, validación y hash. Lógica pura (sin base de datos).
 * El hash (SHA-256 hex del texto canónico) identifica EXACTAMENTE lo que aceptó cada estudiante.
 */

export const MIN_REGULATION_LENGTH = 200;
export const MAX_REGULATION_LENGTH = 40_000;

/** Saltos de línea unificados, sin espacios al final de cada línea ni más de una línea en blanco seguida, sin blancos en los extremos. */
export function normalizeRegulationText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashRegulationText(text: string): string {
  return createHash("sha256").update(normalizeRegulationText(text), "utf8").digest("hex");
}

export type RegulationTextCheck = { ok: true; value: string } | { ok: false; error: string };

/** Valida el texto que la residencia quiere publicar. No acepta campos `{...}` sin completar: lo que se publica lo lee el estudiante tal cual. */
export function validateRegulationText(raw: unknown): RegulationTextCheck {
  if (typeof raw !== "string") return { ok: false, error: "Escribí el reglamento antes de publicarlo." };
  const value = normalizeRegulationText(raw);
  if (value.length < MIN_REGULATION_LENGTH) {
    return { ok: false, error: `El reglamento es muy corto: escribí al menos ${MIN_REGULATION_LENGTH} caracteres.` };
  }
  if (value.length > MAX_REGULATION_LENGTH) {
    return { ok: false, error: `El reglamento es muy largo: el máximo es ${MAX_REGULATION_LENGTH.toLocaleString("es-AR")} caracteres.` };
  }
  const pending = findPlaceholders(value);
  if (pending.length > 0) {
    const shown = pending.slice(0, 4).map((p) => `{${p}}`).join(", ");
    const more = pending.length > 4 ? ` y ${pending.length - 4} más` : "";
    return {
      ok: false,
      error: `Quedan campos sin completar entre llaves (${shown}${more}). Completalos o borrá el artículo antes de publicar.`,
    };
  }
  return { ok: true, value };
}
