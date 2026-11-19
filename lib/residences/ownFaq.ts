/**
 * Preguntas propias de la residencia: pares pregunta/respuesta de texto libre que se guardan en la sección `faq` del perfil
 * (`residence_profile_sections`). Es el sistema ANTERIOR al catálogo de preguntas (`residence_faq_predefined_questions`): hoy la
 * residencia elige las suyas del catálogo en `/residence/<id>/faq`, y estos pares solo se conservan, se editan y se siguen publicando.
 * Lógica pura: la usan la acción de guardado del perfil, el borrador local y el formulario.
 *
 * Tope real: `OWN_FAQ_MAX` (5). No se subió al reemplazar el bloque de preguntas del perfil: ya había residencias con hasta 5 guardadas.
 */
export const OWN_FAQ_MAX = 5;
export const OWN_FAQ_QUESTION_MAX = 200;
export const OWN_FAQ_ANSWER_MAX = 500;

export type OwnFaqItem = { question: string; answer: string };

/**
 * Normaliza lo que llega del formulario: recorta cada texto, aplica los máximos, descarta pares incompletos y corta en `OWN_FAQ_MAX`.
 * Cualquier cosa que no sea una lista da una lista vacía.
 */
export function normalizeOwnFaqItems(parsed: unknown): OwnFaqItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((f) => {
      const item = (f ?? {}) as { question?: unknown; answer?: unknown };
      return {
        question: String(item.question ?? "").trim().slice(0, OWN_FAQ_QUESTION_MAX),
        answer: String(item.answer ?? "").trim().slice(0, OWN_FAQ_ANSWER_MAX),
      };
    })
    .filter((f) => f.question && f.answer)
    .slice(0, OWN_FAQ_MAX);
}

/** Interpreta el campo `faq_json` del formulario. `null` = el formulario no lo mandó: no hay que tocar lo guardado. */
export function parseOwnFaqField(raw: FormDataEntryValue | null): OwnFaqItem[] | null {
  if (raw === null) return null;
  try {
    return normalizeOwnFaqItems(JSON.parse(String(raw)));
  } catch {
    return [];
  }
}

/** Saca los pares totalmente vacíos (los borradores locales viejos guardaban un casillero en blanco). */
export function dropBlankOwnFaq<T extends { question: string; answer: string }>(items: readonly T[]): T[] {
  return items.filter((f) => f.question.trim() !== "" || f.answer.trim() !== "");
}
