"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  notifyWaitlistAvailabilityAction,
  removeFromWaitlistAction,
  type ResidenceWaitlistActionState,
} from "@/app/residence/[residence_id]/waitlist/actions";

const initialState: ResidenceWaitlistActionState = { status: "idle" };

export function WaitlistRowActions({ residenceId, entryId }: { residenceId: string; entryId: string }) {
  const [showRemoveForm, setShowRemoveForm] = useState(false);

  const notifyAction = notifyWaitlistAvailabilityAction.bind(null, residenceId, entryId);
  const [notifyState, notifyFormAction, notifyPending] = useActionState(notifyAction, initialState);

  const removeAction = removeFromWaitlistAction.bind(null, residenceId, entryId);
  const [removeState, removeFormAction, removePending] = useActionState(removeAction, initialState);

  return (
    <div className="mt-3 space-y-2">
      {showRemoveForm ? (
        <form action={removeFormAction} className="flex flex-col gap-2 rounded-field border border-sand-200 p-3">
          <Input label="Motivo (opcional)" name="reason" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={removePending}>
              {removePending ? "Sacando…" : "Confirmar"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowRemoveForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={notifyFormAction}>
            <Button type="submit" size="sm" disabled={notifyPending}>
              {notifyPending ? "Avisando…" : "Avisar que hay lugar"}
            </Button>
          </form>
          <Button size="sm" variant="outline" onClick={() => setShowRemoveForm(true)}>
            Sacar de la lista
          </Button>
        </div>
      )}
      {notifyState.status === "error" && <p className="text-xs font-medium text-danger-fg">{notifyState.message}</p>}
      {removeState.status === "error" && <p className="text-xs font-medium text-danger-fg">{removeState.message}</p>}
    </div>
  );
}
