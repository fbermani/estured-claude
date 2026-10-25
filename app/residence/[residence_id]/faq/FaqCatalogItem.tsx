"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { saveFaqCatalogItemAction, type FaqCatalogState } from "@/app/residence/[residence_id]/faq/actions";
import { CATALOG_ANSWER_MAX, isEditableOwner, listUnfilledFields, hasUnfilledFields, type FaqOwner } from "@/lib/faq/catalog";

const initialState: FaqCatalogState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Guardando…" : "Guardar"}
    </Button>
  );
}

/**
 * Una pregunta del catálogo en el panel de la residencia: interruptor «Mostrar» + respuesta editable partiendo de la sugerida.
 * Las «EstuRed fija» se muestran sin edición. Un solo botón de guardado (sin `onClick` + `setState`).
 */
export function FaqCatalogItem({
  residenceId,
  questionId,
  question,
  owner,
  suggestedAnswer,
  initialSelected,
  initialAnswer,
}: {
  residenceId: string;
  questionId: string;
  question: string;
  owner: FaqOwner;
  suggestedAnswer: string;
  initialSelected: boolean;
  /** Respuesta con la que arranca el campo: el override guardado o, si no hay, la sugerida. */
  initialAnswer: string;
}) {
  const action = saveFaqCatalogItemAction.bind(null, residenceId, questionId);
  const [state, formAction] = useActionState(action, initialState);
  // Controlados: React 19 limpia los campos no controlados tras enviar; así no se pierde lo escrito ante un error.
  const [selected, setSelected] = useState(initialSelected);
  const [answer, setAnswer] = useState(initialAnswer);
  const editable = isEditableOwner(owner);
  const pending = editable ? listUnfilledFields(answer) : [];
  const stillHasBraces = editable && hasUnfilledFields(answer);

  return (
    <form action={formAction} className="rounded-card border-[1.5px] border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-semibold text-ink">
          <span className="mr-2 text-xs font-bold text-ink-faint">{questionId}</span>
          {question}
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="selected"
            checked={selected}
            onChange={(e) => setSelected(e.target.checked)}
            className="h-5 w-5 accent-forest-700"
          />
          Mostrar
        </label>
      </div>

      {editable ? (
        <div className="mt-3">
          <Textarea
            id={`faq-catalog-${questionId}`}
            name="answer"
            label="Respuesta"
            rows={4}
            maxLength={CATALOG_ANSWER_MAX}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            hint={
              stillHasBraces
                ? `Completá los datos entre llaves {…}: borrá las llaves y escribí el dato real.${pending.length ? ` Faltan: ${pending.slice(0, 6).join(", ")}${pending.length > 6 ? "…" : ""}.` : ""} Para mostrarla no puede quedar ninguna.`
                : `${answer.length}/${CATALOG_ANSWER_MAX} caracteres. Partís de la respuesta sugerida; editala con los datos de tu residencia.`
            }
          />
          {answer.trim() !== suggestedAnswer.trim() && (
            <button
              type="button"
              onClick={() => setAnswer(suggestedAnswer)}
              className="mt-1 text-xs font-semibold text-forest-700 underline underline-offset-2"
            >
              Volver a la respuesta sugerida
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-field bg-cream-2 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <Icon name="lock" className="text-sm" />
            Texto fijo de EstuRed
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{suggestedAnswer}</p>
          <p className="mt-2 text-xs text-ink-faint">Solo podés elegir si se muestra: la residencia no lo edita.</p>
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="mt-3 rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {state.message}
        </p>
      )}

      <div className="mt-3">
        <SaveButton />
      </div>
    </form>
  );
}
