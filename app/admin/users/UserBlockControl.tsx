"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { blockUser, unblockUser, type UserBlockActionState } from "@/app/admin/users/actions";
import { Textarea } from "@/components/ui/Input";

const initialState: UserBlockActionState = { status: "idle" };

export function UserBlockControl({ userId, isBlocked }: { userId: string; isBlocked: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [unblockError, setUnblockError] = useState<string | null>(null);

  const blockAction = blockUser.bind(null, userId);
  const [state, formAction, isBlockPending] = useActionState(blockAction, initialState);

  if (isBlocked) {
    return (
      <div className="flex flex-col items-end gap-1">
        {unblockError && (
          <span className="text-xs font-medium" style={{ color: cmd.rose }}>
            {unblockError}
          </span>
        )}
        <AdminButton
          variant="secondary"
          className="!px-3 !py-1 text-xs"
          disabled={isPending}
          onClick={() => {
            setUnblockError(null);
            startTransition(async () => {
              const result = await unblockUser(userId);
              if (result.status === "error") setUnblockError(result.message ?? "Ocurrió un error.");
            });
          }}
        >
          {isPending ? "Desbloqueando…" : "Desbloquear"}
        </AdminButton>
      </div>
    );
  }

  if (!showForm) {
    return (
      <AdminButton variant="danger" className="!px-3 !py-1 text-xs" onClick={() => setShowForm(true)}>
        Bloquear
      </AdminButton>
    );
  }

  return (
    <form action={formAction} className="flex w-56 flex-col items-end gap-1.5">
      <Textarea label="Motivo del bloqueo" name="reason" rows={2} required className="self-stretch" />
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
        <AdminButton type="submit" variant="danger" className="!px-3 !py-1 text-xs" disabled={isBlockPending}>
          {isBlockPending ? "Bloqueando…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
