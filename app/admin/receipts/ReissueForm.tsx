"use client";

import { useActionState, useState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { reissueReceiptAction, type ReissueReceiptState } from "@/app/admin/receipts/actions";

const initialState: ReissueReceiptState = { status: "idle" };

export function ReissueForm({ receiptId }: { receiptId: string }) {
  const action = reissueReceiptAction.bind(null, receiptId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);

  if (state.status === "saved") {
    return (
      <p className="text-xs font-semibold" style={{ color: cmd.emerald }}>
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <AdminButton variant="secondary" onClick={() => setOpen(true)}>
        Reemitir
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[240px] flex-col gap-2">
      <textarea
        name="reason"
        rows={2}
        required
        placeholder="Motivo de la reemisión (obligatorio)"
        className="w-full rounded border px-2.5 py-1.5 text-xs"
        style={{ borderColor: cmd.outline }}
      />
      {state.status === "error" && (
        <p className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <AdminButton type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </AdminButton>
        <AdminButton type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Reemitiendo…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
