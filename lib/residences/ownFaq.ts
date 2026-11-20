/**
 * Preguntas propias de la residencia: pares pregunta/respuesta de texto libre que se guardan en la sección `faq` del perfil
 * (`residence_profile_sections`). Son un complemento del catálogo de preguntas (`residence_faq_predefined_questions`): cuando ninguna
 * del catálogo representa lo que le preguntan a la residencia, escribe la suya en `/residence/<id>/faq` («Preguntas propias de tu
 * residencia»). También se pueden editar o quitar desde la configuración del perfil (`faq_json`).
 * Lógica pura: la usan la acción de guardado del perfil, la acción de la pantalla de preguntas, el borrador local y los formularios.
 *
 * Tope real: `OWN_FAQ_MAX` (5). No se subió al reemplazar el bloque de preguntas del perfil: ya había residencias con hasta 5 guardadas.
 */
import { normalizeFreeText } from "@/lib/faq/validateFaq";

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

export type OwnFaqCheck = { ok: true; items: OwnFaqItem[] } | { ok: false; error: string };

/**
 * Validación ESTRICTA para guardar desde la pantalla de preguntas (a diferencia de `normalizeOwnFaqItems`, que recorta y descarta en
 * silencio). Los pares totalmente vacíos se ignoran; un par a medias, un texto pasado de largo o más de `OWN_FAQ_MAX` pares devuelven un
 * error en español con el número de la pregunta tal como se ve en la lista. Los saltos de línea de la pregunta pasan a espacios.
 */
export function validateOwnFaqItems(raw: unknown): OwnFaqCheck {
  if (!Array.isArray(raw)) return { ok: false, error: "No pudimos leer tus preguntas propias. Recargá la página y probá de nuevo." };
  if (raw.length > OWN_FAQ_MAX * 4) return { ok: false, error: `Podés tener hasta ${OWN_FAQ_MAX} preguntas propias.` };
  const items: OwnFaqItem[] = [];
  for (const [index, entry] of raw.entries()) {
    const item = (entry ?? {}) as { question?: unknown; answer?: unknown };
    const question = normalizeFreeText(item.question).replace(/\s*\n\s*/g, " ");
    const answer = normalizeFreeText(item.answer);
    if (!question && !answer) continue;
    const n = index + 1;
    if (!question) return { ok: false, error: `A la pregunta propia ${n} le falta la pregunta. Completala o quitala.` };
    if (!answer) return { ok: false, error: `A la pregunta propia ${n} le falta la respuesta. Completala o quitala.` };
    if (question.length > OWN_FAQ_QUESTION_MAX) {
      return { ok: false, error: `La pregunta propia ${n} es muy larga: el máximo son ${OWN_FAQ_QUESTION_MAX} caracteres.` };
    }
    if (answer.length > OWN_FAQ_ANSWER_MAX) {
      return { ok: false, error: `La respuesta de la pregunta propia ${n} es muy larga: el máximo son ${OWN_FAQ_ANSWER_MAX} caracteres.` };
    }
    items.push({ question, answer });
  }
  if (items.length > OWN_FAQ_MAX) {
    return { ok: false, error: `Podés tener hasta ${OWN_FAQ_MAX} preguntas propias. Quitá ${items.length - OWN_FAQ_MAX} para guardar.` };
  }
  return { ok: true, items };
}

/** Forma canónica para comparar lo escrito con lo guardado: sin pares vacíos y con los textos normalizados. */
function canonicalOwnFaq(items: readonly OwnFaqItem[]): string {
  return JSON.stringify(
    items
      .map((f) => ({ q: normalizeFreeText(f.question).replace(/\s*\n\s*/g, " "), a: normalizeFreeText(f.answer) }))
      .filter((f) => f.q !== "" || f.a !== ""),
  );
}

/** ¿Lo escrito en pantalla difiere de lo guardado? Ignora los casilleros vacíos y los espacios sobrantes. */
export function ownFaqDirty(draft: readonly OwnFaqItem[], saved: readonly OwnFaqItem[]): boolean {
  return canonicalOwnFaq(draft) !== canonicalOwnFaq(saved);
}
