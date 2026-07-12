"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  leaveWaitlistAction,
  stayInWaitlistAction,
  activateFromWaitlistAction,
  type WaitlistActionState,
} from "@/app/students/waitlist/actions";

const initialState: WaitlistActionState = { status: "idle" };

export function WaitlistEntryCard({
  entryId,
  canActivate,
  showStay,
}: {
  entryId: string;
  canActivate: boolean;
  showStay: boolean;
}) {
  const [showActivateForm, setShowActivateForm] = useState(false);

  const leaveAction = leaveWaitlistAction.bind(null, entryId);
  const [leaveState, leaveFormAction, leavePending] = useActionState(leaveAction, initialState);

  const stayAction = stayInWaitlistAction.bind(null, entryId);
  const [stayState, stayFormAction, stayPending] = useActionState(stayAction, initialState);

  const activateAction = activateFromWaitlistAction.bind(null, entryId);
  const [activateState, activateFormAction, activatePending] = useActionState(activateAction, initialState);

  return (
    <div className="mt-4 space-y-3">
      {showActivateForm ? (
        <form action={activateFormAction} className="flex flex-col gap-3 rounded-field border border-sand-200 p-4">
          <Input label="Fecha de ingreso deseada" name="desired_start_date" type="date" required />
          <Input label="Duración (meses)" name="initial_duration_months" type="number" min={1} max={24} defaultValue={6} required />
          {activateState.status === "error" && (
            <p role="alert" className="text-sm font-medium text-danger-fg">
              {activateState.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={activatePending}>
              {activatePending ? "Enviando…" : "Confirmar solicitud"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowActivateForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canActivate && (
            <Button size="sm" onClick={() => setShowActivateForm(true)}>
              Activar solicitud
            </Button>
          )}
          {showStay && (
            <form action={stayFormAction}>
              <Button type="submit" size="sm" variant="outline" disabled={stayPending}>
                {stayPending ? "Guardando…" : "Quedarme en lista"}
              </Button>
            </form>
          )}
          <form action={leaveFormAction}>
            <Button type="submit" size="sm" variant="outline" disabled={leavePending}>
              {leavePending ? "Saliendo…" : "Salir de la lista"}
            </Button>
          </form>
        </div>
      )}
      {leaveState.status === "error" && <p className="text-xs font-medium text-danger-fg">{leaveState.message}</p>}
      {stayState.status === "error" && <p className="text-xs font-medium text-danger-fg">{stayState.message}</p>}
    </div>
  );
}
