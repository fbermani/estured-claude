"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import {
  grantOperationalAccessAction,
  revokeOperationalAccessAction,
  type OperationalAccessActionState,
} from "@/app/admin/residences/actions";
import { Input, Textarea } from "@/components/ui/Input";

const initialState: OperationalAccessActionState = { status: "idle" };

/** Mecanismo de acceso freemium a Gestión Operativa (docs/12 §15.3, migración 0030). */
export function OperationalAccessControl({
  residenceId,
  hasAccess,
  expiresUntil,
}: {
  residenceId: string;
  hasAccess: boolean;
  expiresUntil: string | null;
}) {
  const [showForm, setShowForm] = useState(false);

  const action = hasAccess ? revokeOperationalAccessAction.bind(null, residenceId) : grantOperationalAccessAction.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (!showForm) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <AdminButton variant={hasAccess ? "danger" : "secondary"} className="!px-3 !py-1 text-xs" onClick={() => setShowForm(true)}>
          {hasAccess ? "Revocar acceso" : "Otorgar acceso"}
        </AdminButton>
        {hasAccess && expiresUntil && (
          <span className="text-xs" style={{ color: cmd.outline }}>
            Hasta {formatDateOnly(expiresUntil)}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-64 flex-col items-end gap-1.5">
      <Textarea label="Motivo (obligatorio)" name="reason" rows={2} required className="self-stretch" />
      {!hasAccess && (
        <Input label="Fecha límite (opcional)" hint="Para Residencias fundadoras." type="date" name="expires_at" className="self-stretch" />
      )}
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
        <AdminButton type="submit" variant={hasAccess ? "danger" : "secondary"} className="!px-3 !py-1 text-xs" disabled={isPending}>
          {isPending ? "Guardando…" : "Confirmar"}
        </AdminButton>
      </div>
    </form>
  );
}
