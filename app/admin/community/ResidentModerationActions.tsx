"use client";

import { useState } from "react";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { limitResidentVisibility, restoreResidentVisibility, markResidentInactive } from "@/app/admin/community/actions";

/** Acciones de moderación por residente (docs/09 §21.3) — ocultar/restaurar visibilidad, marcar inactivo. */
export function ResidentModerationActions({ residentStayId, status }: { residentStayId: string; status: string }) {
  const [pendingAction, setPendingAction] = useState<"limit" | "inactive" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pendingAction) {
    return (
      <div className="rounded p-2" style={{ border: `1px solid ${cmd.border}`, backgroundColor: cmd.surfaceContainer }}>
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
          Motivo (obligatorio)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          autoFocus
          className="mt-1 w-full rounded px-2 py-1 text-xs"
          style={{ border: `1px solid ${cmd.outline}` }}
        />
        {error && (
          <p className="mt-1 text-xs font-medium" style={{ color: cmd.rose }}>
            {error}
          </p>
        )}
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result =
                pendingAction === "limit" ? await limitResidentVisibility(residentStayId, reason) : await markResidentInactive(residentStayId, reason);
              setBusy(false);
              if (result.ok) {
                setPendingAction(null);
                setReason("");
              } else {
                setError(result.error);
              }
            }}
            className="rounded px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: cmd.rose }}
          >
            {busy ? "Guardando…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingAction(null);
              setError(null);
              setReason("");
            }}
            className="text-xs font-semibold"
            style={{ color: cmd.outline }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {status === "visibility_limited" ? (
        <AdminButton
          type="button"
          variant="secondary"
          className="px-3 py-1 text-xs"
          onClick={async () => {
            setBusy(true);
            const result = await restoreResidentVisibility(residentStayId);
            setBusy(false);
            if (!result.ok) setError(result.error);
          }}
          disabled={busy}
        >
          Restaurar visibilidad
        </AdminButton>
      ) : (
        <AdminButton type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={() => setPendingAction("limit")}>
          Limitar visibilidad
        </AdminButton>
      )}
      <AdminButton type="button" variant="danger" className="px-3 py-1 text-xs" onClick={() => setPendingAction("inactive")}>
        Marcar inactivo
      </AdminButton>
      {error && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {error}
        </span>
      )}
    </div>
  );
}
