"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { communicateAction, markReviewedAction, type FollowupAdminState } from "@/app/admin/followups/actions";
import { Textarea } from "@/components/ui/Input";

const initial: FollowupAdminState = { status: "idle" };

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
      <Textarea label="Nota interna" hint="La residencia nunca la ve." name="note" rows={3} maxLength={2000} />
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
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Comunicar a la residencia (opcional, por Soporte)
      </p>
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
      <Textarea label="Mensaje a la residencia" name="text" rows={4} maxLength={1000} defaultValue={defaultText} />
      <Feedback state={state} />
      <AdminButton type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Comunicar a la residencia"}
      </AdminButton>
    </form>
  );
}
