"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { activateResidentStayAction, type ResidencyActionState } from "@/app/students/residency/actions";

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

// El toggle "ocultarme de la comunidad" se retiró (decisión del dueño,
// Ciclo 39): el perfil siempre es visible una vez activada la cuenta.
// setResidentVisibilityAction/setResidentVisibility quedan intactos en
// app/students/residency/actions.ts y lib/residents/ (con su test) por
// si la regla se revierte, pero ya no tienen entry point de UI.
