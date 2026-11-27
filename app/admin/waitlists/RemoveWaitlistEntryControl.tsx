"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { removeWaitlistEntryAction, type RemoveWaitlistActionState } from "@/app/admin/waitlists/actions";
import { Textarea } from "@/components/ui/Input";

const initialState: RemoveWaitlistActionState = { status: "idle" };

export function RemoveWaitlistEntryControl({ waitlistEntryId }: { waitlistEntryId: string }) {
  const [showForm, setShowForm] = useState(false);
  const action = removeWaitlistEntryAction.bind(null, waitlistEntryId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "saved") {
    return (
      <span className="text-xs font-semibold" style={{ color: cmd.emerald }}>
        {state.message}
      </span>
    );
  }

  if (!showForm) {
    return (
      <AdminButton variant="danger" className="!px-3 !py-1 text-xs" onClick={() => setShowForm(true)}>
        Sacar
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col items-end gap-1.5">
      <Textarea label="Motivo (obligatorio)" name="reason" rows={2} required className="self-stretch" />
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
        <AdminButton type="submit" variant="danger" className="!px-3 !py-1 text-xs" disabled={isPending}>
          {isPending ? "Sacando…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
