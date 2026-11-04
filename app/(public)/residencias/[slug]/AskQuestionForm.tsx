"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DrawCheck } from "@/components/ui/DrawCheck";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Input";
import { askResidenceQuestionAction, type AskQuestionState } from "@/app/(public)/residencias/[slug]/faq-actions";
import { QUESTION_MAX } from "@/lib/faq/validateFaq";

const initialState: AskQuestionState = { status: "idle" };

/** "¿Tenés otra pregunta?" — pregunta libre a la residencia (D9). Sin datos extra: ni email ni nombre. */
export function AskQuestionForm({ residenceId, signedIn }: { residenceId: string; signedIn: boolean }) {
  const action = askResidenceQuestionAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  // Controlado: React 19 limpia los campos no controlados tras enviar, y no queremos perder lo escrito si hay un error.
  const [text, setText] = useState("");

  if (state.status === "sent") {
    return (
      <div role="status" className="flex items-center gap-4 rounded-card border-[1.5px] border-line bg-mint px-5 py-4 text-sm text-forest-700">
        <DrawCheck className="size-12" />
        <div className="dc-rise">
          <p className="font-semibold">Registramos tu pregunta.</p>
          <p className="mt-1">
            La residencia responde cuando puede; no es una respuesta automática.
            {signedIn
              ? " Si la responden, te avisamos en la app y la vas a ver acá."
              : " Si la responden, la vas a ver publicada acá."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-card border-[1.5px] border-line bg-paper p-5">
      <h3 className="text-base font-bold text-ink">¿Tenés otra pregunta?</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Escribila acá y se la hacemos llegar a la residencia. La residencia responde cuando puede; no es una respuesta
        automática. No hace falta que dejes tus datos.
      </p>

      <p className="mt-3 flex items-start gap-2 rounded-field bg-amber-soft-100 px-3.5 py-2.5 text-[13px] font-semibold leading-snug text-amber-soft-700">
        <Icon name="fact_check" className="text-lg" />
        <span>Asegurate de que la respuesta no esté ya en esta ficha ni en las preguntas frecuentes antes de enviarla.</span>
      </p>

      {/* Honeypot: invisible para personas. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <div className="mt-3">
        <Textarea
          id="faq-question"
          name="question"
          label="Tu pregunta"
          rows={3}
          required
          minLength={10}
          maxLength={QUESTION_MAX}
          placeholder="Ej.: ¿Se pueden recibir visitas los fines de semana?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          hint={`${text.length}/${QUESTION_MAX} caracteres. No incluyas datos personales ni de contacto; la residencia responde por acá.`}
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" variant="outline" className="mt-3" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar pregunta"}
      </Button>
    </form>
  );
}
