/**
 * Catálogo único de preguntas frecuentes (DR14, docs/06 §17.1–17.2, docs/08 §7.16). Puro y sin `server-only`: lo usan la pantalla de la
 * residencia (solo para contadores y avisos), la ficha pública y los tests. La validación que vale es siempre la del servidor.
 */
import { normalizeFreeText } from "@/lib/faq/validateFaq";

/** `estured` = texto fijo de plataforma (la residencia solo elige mostrarla); `residence` = completa los {campos}. Ninguna parte fija es editable. */
export type FaqOwner = "estured" | "residence";

export type FaqCategory =
  | "antes_de_reservar"
  | "requisitos"
  | "costos_y_pagos"
  | "convivencia_y_reglas"
  | "visitas"
  | "que_llevar"
  | "estadia_y_salida"
  | "privacidad_y_seguridad";

/** Orden y nombre de los temas (Parte B de `docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`). */
export const FAQ_CATEGORIES: { key: FaqCategory; label: string }[] = [
  { key: "antes_de_reservar", label: "Antes de reservar" },
  { key: "requisitos", label: "Requisitos" },
  { key: "costos_y_pagos", label: "Costos y pagos" },
  { key: "convivencia_y_reglas", label: "Convivencia y reglas" },
  { key: "visitas", label: "Visitas" },
  { key: "que_llevar", label: "Qué llevar" },
  { key: "estadia_y_salida", label: "Estadía y salida" },
  { key: "privacidad_y_seguridad", label: "Privacidad y seguridad" },
];

export function categoryLabel(key: string): string {
  return FAQ_CATEGORIES.find((c) => c.key === key)?.label ?? "Otros";
}

/** Tope de la respuesta editada (el catálogo trae textos más largos que la FAQ libre). */
export const CATALOG_ANSWER_MAX = 3000;

export type CatalogQuestion = {
  id: string;
  category: string;
  question_text: string;
  suggested_answer: string;
  owner: FaqOwner;
  display_order: number;
};

export type CatalogSelection = { is_selected: boolean; answer_override: string | null };

/** Solo las de la residencia se editan; las «EstuRed fija» nunca. */
export function isEditableOwner(owner: FaqOwner): boolean {
  return owner === "residence";
}

/** ¿Quedan campos `{…}` sin completar? Cualquier llave que sobre cuenta (también las anidadas). */
export function hasUnfilledFields(text: string): boolean {
  return /[{}]/.test(text);
}

/** Nombres de los campos pendientes (`{tipo_visita: a / b}` → `tipo_visita`; también los anidados), sin repetir y en orden de aparición. */
export function listUnfilledFields(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/\{\s*([\p{L}\p{N}_]+)/gu)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/** Texto que ve el visitante: el override si existe, si no la sugerida. */
export function effectiveAnswer(question: Pick<CatalogQuestion, "suggested_answer">, selection: CatalogSelection | null | undefined): string {
  const override = selection?.answer_override?.trim();
  return override ? override : question.suggested_answer;
}

export type SaveCheck = { ok: true; override: string | null } | { ok: false; error: string };

/**
 * Valida lo que la residencia quiere guardar para una pregunta del catálogo.
 * - `estured`: no hay override (se ignora lo que llegue).
 * - Resto: el texto editado se normaliza; vacío o igual a la sugerida → sin override. Para MOSTRARLA no pueden quedar campos `{…}`.
 *   Guardada como oculta se admite un borrador con campos pendientes.
 */
export function checkCatalogSave(
  question: Pick<CatalogQuestion, "owner" | "suggested_answer">,
  input: { selected: boolean; answer: unknown },
): SaveCheck {
  if (!isEditableOwner(question.owner)) return { ok: true, override: null };
  const text = normalizeFreeText(input.answer);
  if (text.length > CATALOG_ANSWER_MAX) {
    return { ok: false, error: `La respuesta es muy larga: el máximo son ${CATALOG_ANSWER_MAX} caracteres.` };
  }
  const override = text === "" || text === normalizeFreeText(question.suggested_answer) ? null : text;
  const finalText = override ?? question.suggested_answer;
  if (input.selected && hasUnfilledFields(finalText)) {
    const fields = listUnfilledFields(finalText);
    const detail = fields.length ? ` Faltan: ${fields.slice(0, 6).join(", ")}${fields.length > 6 ? "…" : ""}.` : "";
    return {
      ok: false,
      error: `Completá los datos entre llaves {…} antes de mostrar esta pregunta (borrá las llaves y escribí el dato).${detail}`,
    };
  }
  return { ok: true, override };
}
