"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { pauseResidenceAction, reactivateResidenceAction, type PauseResidenceActionState } from "@/app/admin/residences/actions";
import { Textarea } from "@/components/ui/Input";

const initialState: PauseResidenceActionState = { status: "idle" };

export function PauseResidenceControl({ residenceId, isPaused }: { residenceId: string; isPaused: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  const pauseAction = pauseResidenceAction.bind(null, residenceId);
  const [state, formAction, isPausePending] = useActionState(pauseAction, initialState);

  if (isPaused) {
    return (
      <div className="flex flex-col items-end gap-1">
        {reactivateError && (
          <span className="text-xs font-medium" style={{ color: cmd.rose }}>
            {reactivateError}
          </span>
        )}
        <AdminButton
          variant="secondary"
          className="!px-3 !py-1 text-xs"
          disabled={isPending}
          onClick={() => {
            setReactivateError(null);
            startTransition(async () => {
              const result = await reactivateResidenceAction(residenceId);
              if (result.status === "error") setReactivateError(result.message ?? "Ocurrió un error.");
            });
          }}
        >
          {isPending ? "Reactivando…" : "Reactivar"}
        </AdminButton>
      </div>
    );
  }

  if (!showForm) {
    return (
      <AdminButton variant="danger" className="!px-3 !py-1 text-xs" onClick={() => setShowForm(true)}>
        Pausar
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col items-end gap-1.5">
      <Textarea label="Motivo de la pausa" name="reason" rows={2} required className="self-stretch" />
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: cmd.onSurfaceVariant }}
          onClick={() => setShowForm(false)}
        >
          Cancelar
        </button>
        <AdminButton type="submit" variant="danger" className="!px-3 !py-1 text-xs" disabled={isPausePending}>
          {isPausePending ? "Pausando…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
