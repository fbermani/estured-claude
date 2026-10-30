"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  activateWithCodeAction,
  activateWithInviteAction,
  sendResidencyCodeAction,
  type ResidencyActionState,
} from "@/app/students/residency/actions";

const initialState: ResidencyActionState = { status: "idle" };

/**
 * Activar una estadía cargada con tu mail (DR19): primero se verifica el mail con un código; el mail coincidente solo no alcanza.
 * Si la residencia te mandó un enlace personal, usá ese enlace: activa sin código cuando llegó por mail.
 */
export function ActivateResidentStayButton({ residentStayId }: { residentStayId: string }) {
  const [sendState, sendAction, sending] = useActionState(sendResidencyCodeAction.bind(null, residentStayId), initialState);
  const [activateState, activateAction, activating] = useActionState(activateWithCodeAction.bind(null, residentStayId), initialState);
  const sent = sendState.status === "saved";

  return (
    <div className="mt-2 space-y-2">
      <form action={sendAction}>
        <Button type="submit" size="sm" variant={sent ? "outline" : "primary"} disabled={sending}>
          {sending ? "Enviando…" : sent ? "Reenviar código" : "Activar mi estadía"}
        </Button>
        <p className="mt-1 text-xs text-ink-faint">Te mandamos un código al mail de tu cuenta para confirmar que sos vos.</p>
      </form>
      {sendState.status === "error" && <p role="alert" className="text-xs font-medium text-danger-fg">{sendState.message}</p>}
      {sent && <p className="text-xs font-medium text-forest-700">{sendState.message}</p>}
      {sent && (
        <form action={activateAction} className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Input label="Código" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </div>
          <Button type="submit" size="sm" disabled={activating}>
            {activating ? "Activando…" : "Confirmar"}
          </Button>
        </form>
      )}
      {activateState.status === "error" && <p role="alert" className="text-xs font-medium text-danger-fg">{activateState.message}</p>}
    </div>
  );
}

/** Activar con el enlace personal ya verificado (cuenta existente con sesión). */
export function ActivateWithInviteButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activateWithInviteAction.bind(null, token), initialState);
  return (
    <form action={action}>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Activando…" : "Activar mi estadía"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </form>
  );
}

// El toggle "ocultarme de la comunidad" se retiró (decisión del dueño,
// Ciclo 39): el perfil siempre es visible una vez activada la cuenta.
// setResidentVisibilityAction/setResidentVisibility quedan intactos en
// app/students/residency/actions.ts y lib/residents/ (con su test) por
// si la regla se revierte, pero ya no tienen entry point de UI.
