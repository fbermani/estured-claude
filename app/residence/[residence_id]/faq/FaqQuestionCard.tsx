"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { moderateFaqQuestionAction, type FaqModerationState } from "@/app/residence/[residence_id]/faq/actions";
import { ANSWER_MAX } from "@/lib/faq/validateFaq";

const initialState: FaqModerationState = { status: "idle" };

function SubmitButton({
  intent,
  label,
  pendingLabel,
  variant = "outline",
}: {
  intent: "answer" | "hide" | "restore";
  label: string;
  pendingLabel: string;
  variant?: "primary" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value={intent} variant={variant} size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Una pregunta libre en el panel de la residencia. Botones con `name`/`value`
 * nativos (no `onClick` + `setState`): el intent viaja con el submit.
 */
export function FaqQuestionCard({
  residenceId,
  questionId,
  status,
  initialAnswer,
}: {
  residenceId: string;
  questionId: string;
  status: "pending" | "answered" | "hidden";
  initialAnswer: string;
}) {
  const action = moderateFaqQuestionAction.bind(null, residenceId, questionId);
  const [state, formAction] = useActionState(action, initialState);
  // Controlado: React 19 limpia los campos no controlados tras enviar; así no se pierde lo escrito ante un error.
  const [answer, setAnswer] = useState(initialAnswer);

  return (
    <form action={formAction} className="mt-3 space-y-3">
      {status !== "hidden" && (
        <Textarea
          id={`faq-answer-${questionId}`}
          name="answer"
          label={status === "answered" ? "Respuesta publicada" : "Tu respuesta"}
          rows={3}
          maxLength={ANSWER_MAX}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Respondé con información concreta y verificable. No confirmes disponibilidad ni precios por acá."
          hint={`${answer.length}/${ANSWER_MAX} caracteres. Se publica en tu ficha apenas la guardás.`}
        />
      )}

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          Listo, guardamos el cambio.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "hidden" ? (
          <SubmitButton intent="restore" label="Restaurar" pendingLabel="Restaurando…" />
        ) : (
          <>
            <SubmitButton
              intent="answer"
              variant="primary"
              label={status === "answered" ? "Guardar cambios" : "Responder y publicar"}
              pendingLabel="Guardando…"
            />
            <SubmitButton intent="hide" variant="ghost" label="Ocultar" pendingLabel="Ocultando…" />
          </>
        )}
      </div>
    </form>
  );
}
