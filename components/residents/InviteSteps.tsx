"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  declineInviteAction,
  sendInviteCodeAction,
  verifyInviteCodeAction,
  type InviteStepState,
} from "@/app/(public)/register/student/inviteActions";

const idle: InviteStepState = { status: "idle" };

function Feedback({ state }: { state: InviteStepState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-2 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">
        {state.message}
      </p>
    );
  }
  if (state.status === "sent") return <p className="mt-2 text-sm font-medium text-forest-700">{state.message}</p>;
  return null;
}

/**
 * Verificar el mail con un código (DR19). Dos pasos en una tarjeta: «Mandame el código» y «Ingresá el código». Si la residencia no cargó
 * mail (`askEmail`), la persona escribe el suyo. Con `useSessionEmail` el código va al mail de la cuenta con sesión.
 */
export function InviteCodeStep({
  token,
  maskedEmail,
  askEmail,
  useSessionEmail = false,
}: {
  token: string;
  maskedEmail: string | null;
  askEmail: boolean;
  useSessionEmail?: boolean;
}) {
  const router = useRouter();
  const [sendState, sendAction, sending] = useActionState(sendInviteCodeAction.bind(null, token, useSessionEmail), idle);
  const [verifyState, verifyAction, verifying] = useActionState(verifyInviteCodeAction.bind(null, token), idle);

  useEffect(() => {
    if (verifyState.status === "verified") router.refresh();
  }, [verifyState.status, router]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Para confirmar que el mail es tuyo, te mandamos un código de 6 números
        {maskedEmail && !askEmail ? <> a <span className="font-semibold text-ink">{maskedEmail}</span></> : null}.
      </p>
      <form action={sendAction} className="flex flex-wrap items-end gap-3">
        {askEmail && !useSessionEmail && (
          <div className="min-w-56 flex-1">
            <Input label="Tu mail" name="email" type="email" autoComplete="email" required />
          </div>
        )}
        <Button type="submit" variant={sendState.status === "sent" ? "outline" : "primary"} size="sm" disabled={sending}>
          {sending ? "Enviando…" : sendState.status === "sent" ? "Reenviar código" : "Mandame el código"}
        </Button>
      </form>
      <Feedback state={sendState} />
      {sendState.status === "sent" && (
        <form action={verifyAction} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input label="Código" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </div>
          <Button type="submit" size="sm" disabled={verifying}>
            {verifying ? "Verificando…" : "Verificar"}
          </Button>
        </form>
      )}
      <Feedback state={verifyState} />
    </div>
  );
}

/** «No vivo ahí / no soy yo»: la residencia lo ve en su lista. Confirmación en dos pasos para no apretarlo por error. */
export function DeclineInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState(declineInviteAction.bind(null, token), idle);
  if (state.status === "declined") return <p className="text-sm font-medium text-forest-700">{state.message}</p>;
  return (
    <details className="text-sm text-ink-soft">
      <summary className="cursor-pointer font-semibold hover:text-ink">No vivo ahí / no soy yo</summary>
      <form action={action} className="mt-2 space-y-2">
        <p className="text-xs text-ink-faint">Le avisamos a la residencia y este enlace deja de funcionar. No se crea ni se vincula nada.</p>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Avisando…" : "Avisar a la residencia"}
        </Button>
        {state.status === "error" && <p role="alert" className="text-sm font-medium text-danger-fg">{state.message}</p>}
      </form>
    </details>
  );
}
