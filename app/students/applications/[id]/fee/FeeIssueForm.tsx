"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { reportFeePaymentIssue, type FeeMethodState } from "@/app/students/applications/[id]/fee/payerActions";

const initialState: FeeMethodState = { status: "idle" };

/** «No pude realizar el pago» del fee (DR64 (e)): acción secundaria con motivo opcional. Avisa a EstuRed; no hay chat con EstuRed. */
export function FeeIssueForm({ applicationId }: { applicationId: string }) {
  const action = reportFeePaymentIssue.bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => setOpen(true)}>
        No pude realizar el pago
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-field border border-line-2 bg-sand-50 p-4">
      <Textarea
        label="¿Qué pasó? (opcional)"
        name="reason"
        rows={3}
        maxLength={200}
        hint="Si lo escribís, que tenga al menos 10 caracteres. No pongas datos bancarios."
      />
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Avisando…" : "Avisar a EstuRed"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
