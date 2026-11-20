"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { CompactButton } from "@/components/residences/CompactButton";
import { useFaqEditor } from "@/app/residence/[residence_id]/faq/FaqEditor";
import { OWN_FAQ_ANSWER_MAX, OWN_FAQ_MAX, OWN_FAQ_QUESTION_MAX } from "@/lib/residences/ownFaq";

/**
 * «Preguntas propias de tu residencia»: hasta 5 pares pregunta/respuesta de texto libre, para cuando ninguna del catálogo representa lo
 * que le preguntan. Se publican en la ficha junto a las del catálogo. Su estado vive en `FaqEditorProvider` (entran en «Guardar todo y
 * volver»); este «Guardar» guarda solo esta sección. La validación que vale es la del servidor.
 */
export function OwnFaqSection() {
  const { own, busy } = useFaqEditor();
  const saving = own.status?.state === "saving";

  // Al agregar una pregunta, el foco va a su campo (efecto solo de lectura del DOM).
  useEffect(() => {
    if (own.focusKey !== null) document.getElementById(`faq-own-question-${own.focusKey}`)?.focus();
  }, [own.focusKey]);

  return (
    <section id="faq-own" aria-labelledby="faq-own-title" className="mt-8 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="faq-own-title" className="text-lg font-bold text-ink">
          Preguntas propias de tu residencia
        </h2>
        <span className="rounded-full bg-cream-2 px-3 py-1 text-sm font-bold tabular-nums text-ink-soft">
          {own.drafts.length} de {OWN_FAQ_MAX}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Si ninguna pregunta del catálogo representa lo que más te consultan, escribí la tuya con su respuesta. Se muestra en tu ficha junto a
        las del catálogo. Podés sumar hasta {OWN_FAQ_MAX}.
      </p>
      <p className="mt-2 rounded-field bg-amber-soft-100 px-3 py-2 text-xs font-semibold text-ink-soft">
        No publiques teléfonos ni enlaces para contactar por fuera de EstuRed. No confirmes disponibilidad ni precios por acá: eso se informa en
        la ficha y en la solicitud.
      </p>

      {own.drafts.length === 0 ? (
        <p className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
          Todavía no escribiste preguntas propias. Sumá una si el catálogo no cubre algo que te preguntan seguido.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {own.drafts.map((d, index) => (
            <li key={d.key} className="rounded-card border-[1.5px] border-line bg-paper p-5">
              <div className="flex items-start gap-2">
                <Input
                  id={`faq-own-question-${d.key}`}
                  label={`Pregunta propia ${index + 1}`}
                  value={d.question}
                  maxLength={OWN_FAQ_QUESTION_MAX}
                  onChange={(e) => own.change(d.key, { question: e.target.value })}
                  placeholder="Ej: ¿Se pueden usar parlantes en las habitaciones?"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => own.remove(d.key)}
                  className="mt-7 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-cream-2 hover:text-danger-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  aria-label={`Quitar la pregunta propia ${index + 1}`}
                >
                  <Icon name="close" className="text-lg" aria-hidden />
                </button>
              </div>
              <Textarea
                id={`faq-own-answer-${d.key}`}
                label="Respuesta"
                rows={3}
                value={d.answer}
                maxLength={OWN_FAQ_ANSWER_MAX}
                onChange={(e) => own.change(d.key, { answer: e.target.value })}
                hint={`${d.answer.length}/${OWN_FAQ_ANSWER_MAX} caracteres.`}
              />
            </li>
          ))}
        </ul>
      )}

      {own.status?.state === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {own.status.message}
        </p>
      )}
      {own.status?.state === "saved" && !own.dirty && (
        <p role="status" className="mt-3 rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {own.status.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={own.add} disabled={!own.canAdd || busy}>
          <Icon name="add" className="text-lg" aria-hidden />
          Agregar una pregunta propia
        </Button>
        <CompactButton onClick={own.save} disabled={!own.dirty || busy}>
          {saving ? "Guardando…" : "Guardar preguntas propias"}
        </CompactButton>
        {own.dirty && <span className="text-sm font-semibold text-warning-fg">Cambios sin guardar</span>}
      </div>
      {!own.canAdd && <p className="mt-2 text-xs text-ink-faint">Llegaste al máximo de {OWN_FAQ_MAX}. Quitá una para sumar otra.</p>}
    </section>
  );
}
