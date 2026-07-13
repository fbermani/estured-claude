"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  activateResidentStayAction,
  setResidentVisibilityAction,
  type ResidencyActionState,
} from "@/app/students/residency/actions";

const initialState: ResidencyActionState = { status: "idle" };

export function ActivateResidentStayButton({ residentStayId }: { residentStayId: string }) {
  const action = activateResidentStayAction.bind(null, residentStayId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-2">
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Activando…" : "Activar mi estadía"}
      </Button>
      {state.status === "error" && <p className="mt-1 text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}

export function ToggleResidentVisibilityButton({ residentStayId, hidden }: { residentStayId: string; hidden: boolean }) {
  const action = setResidentVisibilityAction.bind(null, residentStayId, !hidden);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-2">
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Guardando…" : hidden ? "Mostrarme en la comunidad" : "Ocultarme de la comunidad"}
      </Button>
      {state.status === "error" && <p className="mt-1 text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}
