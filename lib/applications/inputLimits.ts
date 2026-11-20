/**
 * Topes y validaciones de entrada de los flujos de solicitud / negociación / propuesta del familiar
 * (auditoría de seguridad 2026-11-16). Los mismos topes (con margen) están como CHECK en la migración 0091.
 */
export const MAX_APPLICATION_TEXT = 1000; // objetivo académico, condiciones especiales, notas, motivos, mensajes
export const MAX_ADJUSTMENT_POLICY = 500;
export const MAX_REJECTION_REASON = 500; // motivo de rechazo del estudiante a la propuesta del familiar

export type TextCheck = { ok: true } | { ok: false; error: string };

/** `ok` si el texto (ya recortado) cabe en `max` caracteres; si no, un mensaje en español con el tope. */
export function checkTextMax(text: string | null | undefined, max: number, label: string): TextCheck {
  if (text && text.length > max) {
    return { ok: false, error: `${label} puede tener hasta ${max} caracteres.` };
  }
  return { ok: true };
}

/** Fecha `YYYY-MM-DD` real del calendario (rechaza `2026-02-31`). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Duración en meses: entero entre 1 y 24 (rechaza `NaN`, decimales y vacío). */
export function parseDurationMonths(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 24 ? n : null;
}
