/**
 * Lógica pura de la pantalla de preguntas de la residencia (`/residence/<id>/faq`): estado «sin guardar» de las preguntas del catálogo
 * y forma del guardado en lote («Guardar todo y volver»). Sin `server-only`: lo usan el cliente y la acción de servidor. La validación
 * que vale es siempre la del servidor (`saveCatalogItem`, `saveOwnFaq`).
 */
import { isEditableOwner, type FaqOwner } from "@/lib/faq/catalog";
import { normalizeFreeText } from "@/lib/faq/validateFaq";

/** Lo que la residencia ve y edita de una pregunta del catálogo. */
export type CatalogDraft = { selected: boolean; answer: string };

/** ¿Lo escrito difiere de lo guardado? Las de texto fijo de EstuRed solo cambian por «Mostrar»; el resto, también por el texto (normalizado). */
export function isCatalogDraftDirty(owner: FaqOwner, draft: CatalogDraft, saved: CatalogDraft): boolean {
  if (draft.selected !== saved.selected) return true;
  if (!isEditableOwner(owner)) return false;
  return normalizeFreeText(draft.answer) !== normalizeFreeText(saved.answer);
}

/** Una pregunta del catálogo dentro de un guardado en lote. */
export type CatalogBatchItem = { id: string; selected: boolean; answer: string };

/** Tope de preguntas por guardado (el catálogo activo tiene unas 50). */
export const FAQ_BATCH_MAX_ITEMS = 120;

export type FaqBatchInput = {
  catalog: CatalogBatchItem[];
  /** Pares de preguntas propias, o `null` si no cambiaron (no se toca lo guardado). */
  own: unknown[] | null;
};

export type FaqBatchInputCheck = { ok: true; value: FaqBatchInput } | { ok: false; error: string };

const BAD_INPUT = "No pudimos leer los cambios. Recargá la página y probá de nuevo.";

/** Forma y tope de lo que manda el cliente. Los textos se validan después, ítem por ítem. */
export function parseFaqBatchInput(raw: unknown): FaqBatchInputCheck {
  if (!raw || typeof raw !== "object") return { ok: false, error: BAD_INPUT };
  const input = raw as { catalog?: unknown; own?: unknown };
  const catalogRaw = input.catalog === undefined ? [] : input.catalog;
  if (!Array.isArray(catalogRaw) || catalogRaw.length > FAQ_BATCH_MAX_ITEMS) return { ok: false, error: BAD_INPUT };
  const seen = new Set<string>();
  const catalog: CatalogBatchItem[] = [];
  for (const entry of catalogRaw) {
    const e = (entry ?? {}) as { id?: unknown; selected?: unknown; answer?: unknown };
    if (typeof e.id !== "string" || !e.id || e.id.length > 40 || typeof e.selected !== "boolean") return { ok: false, error: BAD_INPUT };
    if (e.answer !== undefined && typeof e.answer !== "string") return { ok: false, error: BAD_INPUT };
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    catalog.push({ id: e.id, selected: e.selected, answer: e.answer ?? "" });
  }
  if (input.own !== undefined && input.own !== null && !Array.isArray(input.own)) return { ok: false, error: BAD_INPUT };
  return { ok: true, value: { catalog, own: Array.isArray(input.own) ? input.own : null } };
}

export type FaqBatchItemResult = { ok: true; selected: boolean } | { ok: false; error: string };

export type FaqBatchResult = {
  /** `ok` = todo lo enviado se guardó; `partial` = algo se guardó y algo no; `error` = no se guardó nada. */
  status: "ok" | "partial" | "error";
  /** Error general (sesión vencida, sin acceso, datos ilegibles). */
  message?: string;
  catalog: Record<string, FaqBatchItemResult>;
  /** Resultado de las preguntas propias; ausente si no se enviaron. */
  own?: { ok: true } | { ok: false; error: string };
};

/** Resume un lote: ok si nada falló, partial si hubo de las dos cosas, error si nada se guardó. */
export function summarizeFaqBatch(catalog: Record<string, FaqBatchItemResult>, own: FaqBatchResult["own"]): FaqBatchResult["status"] {
  const results = [...Object.values(catalog), ...(own ? [own] : [])];
  const failed = results.filter((r) => !r.ok).length;
  if (failed === 0) return "ok";
  return failed === results.length ? "error" : "partial";
}

/** Frase para el estado final de «Guardar todo y volver» cuando algo quedó sin guardar. */
export function describeBatchProblems(failedCatalog: number, ownFailed: boolean): string {
  const parts: string[] = [];
  if (failedCatalog > 0) parts.push(failedCatalog === 1 ? "1 pregunta del catálogo" : `${failedCatalog} preguntas del catálogo`);
  if (ownFailed) parts.push("tus preguntas propias");
  if (parts.length === 0) return "";
  return `No pudimos guardar ${parts.join(" y ")}. Revisá el aviso de cada una.`;
}
