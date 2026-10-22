/**
 * Validación de la FAQ simple (D9 / H12). Puro y sin `server-only` para poder
 * testearlo y reusarlo en el cliente solo para contadores (la validación que
 * vale es siempre la del servidor).
 */

export const QUESTION_MIN = 10;
export const QUESTION_MAX = 500;
export const ANSWER_MAX = 1500;
/** Máximo de preguntas por hora por IP (hash) o por usuario con sesión. */
export const QUESTIONS_PER_HOUR = 5;
/** Tope global por hora cuando no hay IP ni sesión (no se puede limitar por origen). */
export const ANONYMOUS_QUESTIONS_PER_HOUR = 20;
/** Tope de preguntas sin responder por residencia, para no inundar su bandeja. */
export const MAX_PENDING_PER_RESIDENCE = 50;

export type TextCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Normaliza texto libre: saltos de línea a `\n`, quita caracteres de control
 * (salvo el salto de línea), recorta cada línea y colapsa líneas en blanco
 * repetidas. No toca el contenido (React escapa al renderizar).
 */
export function normalizeFreeText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateQuestion(raw: unknown): TextCheck {
  const value = normalizeFreeText(raw);
  if (value.length < QUESTION_MIN) {
    return { ok: false, error: `Escribí tu pregunta con un poco más de detalle (mínimo ${QUESTION_MIN} caracteres).` };
  }
  if (value.length > QUESTION_MAX) {
    return { ok: false, error: `La pregunta es muy larga: el máximo son ${QUESTION_MAX} caracteres.` };
  }
  return { ok: true, value };
}

export function validateAnswer(raw: unknown): TextCheck {
  const value = normalizeFreeText(raw);
  if (value.length < 1) {
    return { ok: false, error: "Escribí la respuesta antes de publicarla." };
  }
  if (value.length > ANSWER_MAX) {
    return { ok: false, error: `La respuesta es muy larga: el máximo son ${ANSWER_MAX} caracteres.` };
  }
  return { ok: true, value };
}

/** Recorta para mostrar en una notificación sin cortar a mitad de palabra de forma fea. */
export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
