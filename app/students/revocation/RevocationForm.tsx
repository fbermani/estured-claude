"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { revokeEsturedFeeAction, type RevokeFeeState } from "@/app/students/revocation/actions";

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

  if (state.status === "saved") {
    return (
      <Card className="mt-4 border-sage-300 bg-sage-50 p-5">
        <p className="text-sm font-medium text-sage-800">
          Revocación registrada — en revisión por EstuRed. Te vamos a contactar sobre el estado del reembolso.
        </p>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <div className="mt-4">
        <p className="text-xs text-ink-faint">Te quedan {daysRemaining} día(s) para ejercer este derecho.</p>
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
        <li>La reserva se cancela.</li>
        <li>El comprobante se anula.</li>
        <li>El fee EstuRed <strong>no se reembolsa automáticamente</strong> — EstuRed revisa el caso individualmente.</li>
        <li>Esto no alcanza a montos pagados directamente a la residencia.</li>
      </ul>

      <div>
        <label className="text-sm font-medium text-ink" htmlFor={`reason-${reservationId}`}>
          Motivo (opcional)
        </label>
        <textarea
          id={`reason-${reservationId}`}
          name="reason"
          rows={2}
          className="mt-1.5 w-full rounded-field border border-sand-300 bg-surface px-3 py-2 text-sm"
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
          name="acknowledge_no_automatic_refund"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-petrol-600"
        />
        Entiendo las consecuencias y que el fee no se reembolsa automáticamente.
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
