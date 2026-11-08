"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  notifyWaitlistAvailabilityAction,
  removeFromWaitlistAction,
  type ResidenceWaitlistActionState,
} from "@/app/residence/[residence_id]/waitlist/actions";

const initialState: ResidenceWaitlistActionState = { status: "idle" };
const chip =
  "inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50";

/** Acciones por fila, compactas: «Avisar» (solo si es avisable) y «Sacar». El aviso en bloque vive en la barra de selección. */
export function WaitlistRowActions({
  residenceId,
  entryId,
  canNotify,
}: {
  residenceId: string;
  entryId: string;
  canNotify: boolean;
}) {
  const [showRemoveForm, setShowRemoveForm] = useState(false);

  const notifyAction = notifyWaitlistAvailabilityAction.bind(null, residenceId, entryId);
  const [notifyState, notifyFormAction, notifyPending] = useActionState(notifyAction, initialState);

  const removeAction = removeFromWaitlistAction.bind(null, residenceId, entryId);
  const [removeState, removeFormAction, removePending] = useActionState(removeAction, initialState);

  return (
    <div className="mt-1">
      {showRemoveForm ? (
        <form action={removeFormAction} className="flex flex-col gap-2 rounded-field border border-line p-3">
          <Input label="Motivo (opcional)" name="reason" />
          <div className="flex gap-2">
            <button type="submit" disabled={removePending} className={`${chip} bg-danger-bg text-danger-fg`}>
              {removePending ? "Sacando…" : "Confirmar"}
            </button>
            <button type="button" onClick={() => setShowRemoveForm(false)} className={`${chip} text-ink-soft hover:bg-cream-2`}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-1">
          {canNotify && (
            <form action={notifyFormAction}>
              <button type="submit" disabled={notifyPending} className={`${chip} bg-forest-tint text-forest-700 hover:bg-mint`}>
                {notifyPending ? "Avisando…" : "Avisar"}
              </button>
            </form>
          )}
          <button type="button" onClick={() => setShowRemoveForm(true)} className={`${chip} text-ink-soft hover:bg-cream-2`}>
            Sacar
          </button>
        </div>
      )}
      {notifyState.status === "error" && <p className="text-xs font-medium text-danger-fg">{notifyState.message}</p>}
      {removeState.status === "error" && <p className="text-xs font-medium text-danger-fg">{removeState.message}</p>}
    </div>
  );
}
