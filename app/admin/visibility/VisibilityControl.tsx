"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import {
  issueWarningAction,
  reduceVisibilityAction,
  restoreVisibilityAction,
  addInternalNoteAction,
  type VisibilityActionState,
} from "@/app/admin/visibility/actions";
import type { QualityVisibilityStatus } from "@/lib/residences/setQualityVisibilityByAdmin";

const initialState: VisibilityActionState = { status: "idle" };

const ACTION_BY_TARGET: Record<QualityVisibilityStatus, typeof issueWarningAction> = {
  warning: issueWarningAction,
  reduced_visibility: reduceVisibilityAction,
  normal_visibility: restoreVisibilityAction,
};

const LABEL_BY_TARGET: Record<QualityVisibilityStatus, string> = {
  warning: "Emitir advertencia",
  reduced_visibility: "Reducir visibilidad",
  normal_visibility: "Restaurar visibilidad normal",
};

function StatusChangeForm({
  residenceId,
  target,
  onCancel,
  onSaved,
}: {
  residenceId: string;
  target: QualityVisibilityStatus;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(ACTION_BY_TARGET[target].bind(null, residenceId), initialState);

  useEffect(() => {
    if (state.status === "saved") onSaved();
  }, [state.status, onSaved]);

  if (state.status === "saved") return null;

  return (
    <form action={formAction} className="flex w-64 flex-col items-end gap-1.5">
      <textarea
        name="reason"
        rows={2}
        required
        placeholder="Motivo (obligatorio)"
        className="w-full rounded-xl px-2.5 py-1.5 text-xs"
        style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
      />
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <div className="flex gap-1.5">
        <button type="button" className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }} onClick={onCancel}>
          Cancelar
        </button>
        <AdminButton type="submit" variant="secondary" className="!px-3 !py-1 text-xs" disabled={isPending}>
          {isPending ? "Guardando…" : LABEL_BY_TARGET[target]}
        </AdminButton>
      </div>
    </form>
  );
}

function NoteForm({ residenceId, onCancel, onSaved }: { residenceId: string; onCancel: () => void; onSaved: () => void }) {
  const [state, formAction, isPending] = useActionState(addInternalNoteAction.bind(null, residenceId), initialState);

  useEffect(() => {
    if (state.status === "saved") onSaved();
  }, [state.status, onSaved]);

  if (state.status === "saved") return null;

  return (
    <form action={formAction} className="flex w-64 flex-col items-end gap-1.5">
      <textarea
        name="note"
        rows={2}
        required
        placeholder="Nota interna (obligatoria)"
        className="w-full rounded-xl px-2.5 py-1.5 text-xs"
        style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
      />
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <div className="flex gap-1.5">
        <button type="button" className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }} onClick={onCancel}>
          Cancelar
        </button>
        <AdminButton type="submit" variant="secondary" className="!px-3 !py-1 text-xs" disabled={isPending}>
          {isPending ? "Guardando…" : "Agregar nota"}
        </AdminButton>
      </div>
    </form>
  );
}

export function VisibilityControl({ residenceId, currentStatus }: { residenceId: string; currentStatus: QualityVisibilityStatus }) {
  const [mode, setMode] = useState<QualityVisibilityStatus | "note" | null>(null);

  if (mode === "note") return <NoteForm residenceId={residenceId} onCancel={() => setMode(null)} onSaved={() => setMode(null)} />;
  if (mode) return <StatusChangeForm residenceId={residenceId} target={mode} onCancel={() => setMode(null)} onSaved={() => setMode(null)} />;

  const targets = (["warning", "reduced_visibility", "normal_visibility"] as const).filter((t) => t !== currentStatus);

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {targets.map((t) => (
        <AdminButton key={t} variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => setMode(t)}>
          {LABEL_BY_TARGET[t]}
        </AdminButton>
      ))}
      <AdminButton variant="secondary" className="!px-2.5 !py-1 text-xs" onClick={() => setMode("note")}>
        + Nota interna
      </AdminButton>
    </div>
  );
}
