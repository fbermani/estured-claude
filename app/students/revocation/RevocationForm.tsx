"use client";

import { pluralize } from "@/lib/format/plural";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { revokeEsturedFeeAction, type RevokeFeeState } from "@/app/students/revocation/actions";
import {
  REVOCATION_CONSEQUENCES,
  REVOCATION_SUBMITTED_MESSAGE,
  REVOCATION_UNDERSTANDING_LABEL,
} from "@/lib/revocations/copy";
import { Textarea } from "@/components/ui/Input";

const initialState: RevokeFeeState = { status: "idle" };

export function RevocationForm({
  reservationId,
  residenceName,
  daysRemaining,
}: {
  reservationId: string;
  residenceName: string;
  daysRemaining: number;
}) {
  const action = revokeEsturedFeeAction.bind(null, reservationId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Controlado: ante un error de validación el formulario se reinicia y el motivo escrito no se pierde.
  const [reason, setReason] = useState("");

  if (state.status === "saved") {
    return (
      <Card className="mt-4 border-line-2 bg-mint p-5">
        <p className="text-sm font-medium text-forest-700">{REVOCATION_SUBMITTED_MESSAGE}</p>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <div className="mt-4">
        <p className="text-xs text-ink-faint">{daysRemaining === 1 ? "Te queda" : "Te quedan"} {pluralize(daysRemaining, "día", "días")} para ejercer este derecho.</p>
        <Button variant="outline" className="mt-2" onClick={() => setShowForm(true)}>
          Ejercer revocación
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4 rounded-field border border-sand-200 bg-sand-50 p-4">
      <p className="text-sm font-semibold text-ink">
        Confirmá la revocación del fee de {residenceName}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-ink-soft">
        {REVOCATION_CONSEQUENCES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div>
        <Textarea
          label="Motivo (opcional)"
          id={`reason-${reservationId}`}
          name="reason"
          rows={2}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="acknowledge_understanding"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-forest"
        />
        {REVOCATION_UNDERSTANDING_LABEL}
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={!confirmed || isPending}>
          {isPending ? "Enviando…" : "Confirmar revocación"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
