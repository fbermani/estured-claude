"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { requestRenewalAction, type RenewalFormState } from "@/app/students/renewals/actions";

const initialState: RenewalFormState = { status: "idle" };

export function RequestRenewalForm({ reservationId }: { reservationId: string }) {
  const action = requestRenewalAction.bind(null, reservationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "saved") {
    return (
      <p className="mt-4 rounded-field bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800">
        Solicitud enviada — te avisamos cuando la residencia responda.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <Input
        label="Duración deseada (meses, opcional)"
        name="desired_duration_months"
        type="number"
        min={1}
        max={24}
      />
      <Textarea label="Mensaje para la residencia (opcional)" name="message" rows={2} />
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando…" : "Solicitar renovación"}
      </Button>
    </form>
  );
}
