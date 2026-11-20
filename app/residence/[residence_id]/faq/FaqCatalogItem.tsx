"use client";

import { Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { CompactButton } from "@/components/residences/CompactButton";
import { useFaqEditor } from "@/app/residence/[residence_id]/faq/FaqEditor";
import { CATALOG_ANSWER_MAX, isEditableOwner, listUnfilledFields, hasUnfilledFields } from "@/lib/faq/catalog";

/**
 * Una pregunta del catálogo en el panel de la residencia: interruptor «Mostrar» + respuesta editable partiendo de la sugerida.
 * Las «EstuRed fija» se muestran sin edición. El estado (lo escrito y lo guardado) vive en `FaqEditorProvider`: así «Guardar todo y volver»
 * ve las ediciones sin guardar de todas las preguntas, también las de los temas cerrados. Controlada: no se pierde lo escrito ante un error.
 */
export function FaqCatalogItem({ id }: { id: string }) {
  const ed = useFaqEditor();
  const info = ed.items.find((i) => i.id === id);
  const draft = ed.drafts[id];
  if (!info || !draft) return null;

  const status = ed.statuses[id];
  const dirty = ed.dirtyIds.has(id);
  const editable = isEditableOwner(info.owner);
  const pending = editable ? listUnfilledFields(draft.answer) : [];
  const stillHasBraces = editable && hasUnfilledFields(draft.answer);
  const saving = status?.state === "saving";

  return (
    <div id={`faq-item-${id}`} className="scroll-mt-24 rounded-card border-[1.5px] border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-semibold text-ink">
          {info.question}
          {info.essential && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-soft-100 px-2 py-0.5 align-middle text-xs font-bold text-ink">Esencial</span>
          )}
          {dirty && (
            <span className="ml-2 inline-flex items-center rounded-full bg-warning-bg px-2 py-0.5 align-middle text-xs font-bold text-warning-fg">Sin guardar</span>
          )}
        </p>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={draft.selected}
            onChange={(e) => ed.setSelected(id, e.target.checked)}
            className="h-5 w-5 accent-forest-700"
          />
          Mostrar
        </label>
      </div>

      {editable ? (
        <div className="mt-3">
          <Textarea
            id={`faq-catalog-${id}`}
            label="Respuesta"
            rows={4}
            maxLength={CATALOG_ANSWER_MAX}
            value={draft.answer}
            onChange={(e) => ed.setAnswer(id, e.target.value)}
            hint={
              stillHasBraces
                ? `Completá los datos entre llaves {…}: borrá las llaves y escribí el dato real.${pending.length ? ` Faltan: ${pending.slice(0, 6).join(", ")}${pending.length > 6 ? "…" : ""}.` : ""} Para mostrarla no puede quedar ninguna.`
                : `${draft.answer.length}/${CATALOG_ANSWER_MAX} caracteres. Partís de la respuesta sugerida; editala con los datos de tu residencia.`
            }
          />
          {draft.answer.trim() !== info.suggestedAnswer.trim() && (
            <button
              type="button"
              onClick={() => ed.setAnswer(id, info.suggestedAnswer)}
              className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Volver a la respuesta sugerida
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-field bg-cream-2 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-ink-faint">
            <Icon name="lock" className="text-sm" />
            Texto fijo de EstuRed
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{info.suggestedAnswer}</p>
          <p className="mt-2 text-xs text-ink-faint">Solo podés elegir si se muestra: la residencia no lo edita.</p>
        </div>
      )}

      {status?.state === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {status.message}
        </p>
      )}
      {status?.state === "saved" && !dirty && (
        <p role="status" className="mt-3 rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {status.message}
        </p>
      )}

      <div className="mt-3">
        <CompactButton onClick={() => ed.saveItem(id)} disabled={!dirty || ed.busy}>
          {saving ? "Guardando…" : "Guardar"}
        </CompactButton>
      </div>
    </div>
  );
}
