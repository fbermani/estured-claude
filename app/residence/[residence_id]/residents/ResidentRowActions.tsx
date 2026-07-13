"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { endResidentStayAction, type ResidentsActionState } from "@/app/residence/[residence_id]/residents/actions";

const initialState: ResidentsActionState = { status: "idle" };

export function ResidentRowActions({ residenceId, residentStayId }: { residenceId: string; residentStayId: string }) {
  const action = endResidentStayAction.bind(null, residenceId, residentStayId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-2">
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Cerrando…" : "Marcar estadía terminada"}
      </Button>
      {state.status === "error" && <p className="mt-1 text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}
