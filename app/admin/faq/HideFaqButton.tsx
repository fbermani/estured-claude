"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import {
  hideFaqQuestionAsAdminAction,
  restoreFaqQuestionAsAdminAction,
  type AdminFaqActionState,
} from "@/app/admin/faq/actions";

const initialState: AdminFaqActionState = { status: "idle" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="danger" className="!px-3 !py-1 text-xs" disabled={pending}>
      {pending ? "Ocultando…" : "Ocultar"}
    </AdminButton>
  );
}

export function HideFaqButton({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState(hideFaqQuestionAsAdminAction.bind(null, questionId), initialState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input
        name="reason"
        maxLength={300}
        placeholder="Motivo (opcional)"
        className="w-48 rounded-xl px-2.5 py-1 text-xs"
        style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
      />
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <Submit />
    </form>
  );
}

function RestoreSubmit() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="secondary" className="!px-3 !py-1 text-xs" disabled={pending}>
      {pending ? "Restaurando…" : "Restaurar"}
    </AdminButton>
  );
}

export function RestoreFaqButton({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState(restoreFaqQuestionAsAdminAction.bind(null, questionId), initialState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <RestoreSubmit />
    </form>
  );
}
