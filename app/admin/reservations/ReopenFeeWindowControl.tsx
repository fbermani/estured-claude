"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { FEE_REOPEN_CAP_MESSAGE } from "@/lib/payments/reopenCap";
import { reopenFeeWindowAction, type ReopenFeeWindowActionState } from "@/app/admin/reservations/actions";
import { Textarea } from "@/components/ui/Input";

const initialState: ReopenFeeWindowActionState = { status: "idle" };

export function ReopenFeeWindowControl({ feePaymentId, limitReached = false }: { feePaymentId: string; limitReached?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const action = reopenFeeWindowAction.bind(null, feePaymentId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "saved") {
    return (
      <span className="text-xs font-semibold" style={{ color: cmd.emerald }}>
        {state.message}
      </span>
    );
  }

  if (limitReached) {
    return (
      <span className="text-xs font-semibold" style={{ color: cmd.amber }} title={FEE_REOPEN_CAP_MESSAGE}>
        Ya se reabrió 2 veces: solo Soporte
      </span>
    );
  }

  if (!showForm) {
    return (
      <AdminButton variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => setShowForm(true)}>
        Reabrir
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col items-end gap-1.5">
      <Textarea label="Motivo de reapertura" name="reason" rows={2} required className="self-stretch" />
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
        <AdminButton type="submit" variant="primary" className="!px-3 !py-1 text-xs" disabled={isPending}>
          {isPending ? "Reabriendo…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
