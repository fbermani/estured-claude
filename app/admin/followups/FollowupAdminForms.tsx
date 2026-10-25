"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { communicateAction, markReviewedAction, type FollowupAdminState } from "@/app/admin/followups/actions";

const initial: FollowupAdminState = { status: "idle" };
const field = "mt-1 w-full rounded px-3 py-2 text-sm";

function Feedback({ state }: { state: FollowupAdminState }) {
  if (state.status === "idle") return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className="text-xs font-bold" style={{ color: state.status === "error" ? cmd.rose : cmd.emerald }}>
      {state.message}
    </p>
  );
}

export function ReviewForm({ followupId }: { followupId: string }) {
  const [state, formAction, pending] = useActionState(markReviewedAction.bind(null, followupId), initial);
  return (
    <form action={formAction} className="space-y-2 rounded-lg p-4" style={{ border: `1.5px solid ${cmd.border}` }}>
      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Nota interna (la residencia nunca la ve)
      </label>
      <textarea name="note" rows={3} maxLength={2000} className={field} style={{ border: `1.5px solid ${cmd.border}` }} />
      <Feedback state={state} />
      <AdminButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Guardando…" : "Marcar como revisada"}
      </AdminButton>
    </form>
  );
}

export function CommunicateForm({ followupId, defaultText, alreadyCommunicated = false }: { followupId: string; defaultText: string; alreadyCommunicated?: boolean }) {
  const [state, formAction, pending] = useActionState(communicateAction.bind(null, followupId), initial);
  return (
    <form action={formAction} className="space-y-2 rounded-lg p-4" style={{ border: `1.5px solid ${cmd.border}` }}>
      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Comunicar a la residencia (opcional, por Soporte)
      </label>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Le llega como notificación a quien gestiona residentes. No incluye la respuesta salvo que la escribas vos. Queda registrado.
      </p>
      <p className="text-xs font-bold" style={{ color: cmd.rose }}>
        No pegues la respuesta del estudiante: la residencia no la ve.
      </p>
      {alreadyCommunicated && (
        <label className="flex items-center gap-2 text-xs" style={{ color: cmd.outline }}>
          <input type="checkbox" name="resend" /> Ya se comunicó algo antes: quiero enviar otro mensaje
        </label>
      )}
      <textarea name="text" rows={4} maxLength={1000} defaultValue={defaultText} className={field} style={{ border: `1.5px solid ${cmd.border}` }} />
      <Feedback state={state} />
      <AdminButton type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Comunicar a la residencia"}
      </AdminButton>
    </form>
  );
}
