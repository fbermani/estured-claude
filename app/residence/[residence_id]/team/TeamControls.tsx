"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PermissionChecklist } from "@/app/residence/[residence_id]/team/PermissionChecklist";
import { defaultPermissions, permissionsVersion, STAFF_PERMISSIONS, type PermissionMap } from "@/lib/residences/permissions";
import {
  cancelTeamInvitationAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
  resendTeamInvitationAction,
  updateTeamMemberPermissionsAction,
  type TeamActionState,
} from "@/app/residence/[residence_id]/team/actions";

const initialState: TeamActionState = { status: "idle" };

function enabledCount(map: PermissionMap): number {
  return STAFF_PERMISSIONS.filter((p) => map[p.key]).length;
}

/** Botón de guardar nativo que se deshabilita mientras la acción corre (`useFormStatus`, sin estado propio). */
function SavePermissionsButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Guardando…" : "Guardar permisos"}
    </Button>
  );
}

function Feedback({ state }: { state: TeamActionState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm font-medium text-danger-fg">
        {state.message}
      </p>
    );
  }
  if (state.status === "warning" && state.message) {
    return (
      <p role="status" className="text-sm font-medium text-warning-fg">
        {state.message}
      </p>
    );
  }
  if (state.status === "ok" && state.message) {
    return (
      <p role="status" className="text-sm font-medium text-forest-700">
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * Formulario de invitación: un solo campo (email). El rol es siempre staff y lo fija el servidor.
 * El email está controlado: ante un error se conserva lo escrito (React 19 resetea los campos no controlados al terminar la acción) y
 * solo se vacía cuando la invitación se creó (con o sin email enviado: si no salió, se reenvía desde la lista).
 */
export function InviteForm({ residenceId, disabled }: { residenceId: string; disabled?: boolean }) {
  const action = inviteTeamMemberAction.bind(null, residenceId);
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<PermissionMap>(defaultPermissions);
  const [state, formAction, pending] = useActionState(async (prev: TeamActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.status === "ok" || result.status === "warning") {
      setEmail("");
      setPermissions(defaultPermissions());
    }
    return result;
  }, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <Input
        label="Email de la persona"
        name="email"
        type="email"
        required
        maxLength={200}
        autoComplete="off"
        placeholder="nombre@ejemplo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={disabled || pending}
        hint="Le llega un enlace para sumarse como staff. Vence a los 7 días."
      />
      <details className="rounded-field border border-line bg-cream/60 p-3">
        <summary className="cursor-pointer text-sm font-bold text-ink">
          Permisos iniciales <span className="font-medium text-ink-soft">({enabledCount(permissions)} de {STAFF_PERMISSIONS.length} activos)</span>
        </summary>
        <div className="mt-3">
          <PermissionChecklist value={permissions} onChange={setPermissions} disabled={disabled || pending} />
        </div>
      </details>
      <Button type="submit" size="sm" disabled={disabled || pending} className="w-full sm:w-auto">
        {pending ? "Enviando…" : "Enviar invitación"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Quitar acceso a un staff, con confirmación explícita antes de ejecutar. */
export function RemoveMemberControl({
  residenceId,
  memberUserId,
  email,
}: {
  residenceId: string;
  memberUserId: string;
  email: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = removeTeamMemberAction.bind(null, residenceId, memberUserId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!confirming) {
    return (
      <div className="space-y-1">
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)} className="w-full sm:w-auto">
          Quitar acceso
        </Button>
        <Feedback state={state} />
      </div>
    );
  }
  return (
    <form action={formAction} className="rounded-field border border-danger-fg/30 bg-danger-bg/40 p-3">
      <p className="text-sm text-ink">
        ¿Quitarle el acceso a <span className="break-all font-semibold">{email}</span>? Va a perder el acceso a esta residencia ahora.
        Podés invitarlo de nuevo cuando quieras.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="sm" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Quitando…" : "Sí, quitar acceso"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} className="w-full sm:w-auto">
          Cancelar
        </Button>
      </div>
      <div className="mt-2">
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Reenviar o cancelar una invitación pendiente. */
export function InvitationControls({ residenceId, invitationId }: { residenceId: string; invitationId: string }) {
  const resend = resendTeamInvitationAction.bind(null, residenceId, invitationId);
  const cancel = cancelTeamInvitationAction.bind(null, residenceId, invitationId);
  const [resendState, resendAction, resendPending] = useActionState(resend, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancel, initialState);
  const busy = resendPending || cancelPending;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={resendAction}>
          <Button type="submit" size="sm" variant="outline" disabled={busy} className="w-full sm:w-auto">
            {resendPending ? "Reenviando…" : "Reenviar"}
          </Button>
        </form>
        <form action={cancelAction}>
          <Button type="submit" size="sm" variant="ghost" disabled={busy} className="w-full sm:w-auto">
            {cancelPending ? "Cancelando…" : "Cancelar invitación"}
          </Button>
        </form>
      </div>
      <Feedback state={resendState} />
      <Feedback state={cancelState} />
    </div>
  );
}

/**
 * Panel de permisos de un staff (DR11): casilleros agrupados, atajos que solo rellenan y "Guardar permisos". Los casilleros son
 * controlados: ante un error se conserva lo que tildó el dueño; recién al guardar se escriben (el servidor decide, solo el dueño).
 */
export function StaffPermissionsPanel({
  residenceId,
  memberUserId,
  initial,
}: {
  residenceId: string;
  memberUserId: string;
  initial: PermissionMap;
}) {
  const action = updateTeamMemberPermissionsAction.bind(null, residenceId, memberUserId);
  const [permissions, setPermissions] = useState<PermissionMap>(initial);
  const [state, formAction] = useActionState(action, initialState);
  return (
    <details className="rounded-field border border-line bg-cream/60 p-3">
      <summary className="cursor-pointer text-sm font-bold text-ink">
        Permisos <span className="font-medium text-ink-soft">({enabledCount(permissions)} de {STAFF_PERMISSIONS.length} activos)</span>
      </summary>
      <form action={formAction} className="mt-3 space-y-3">
        {/* Versión de los permisos que se leyeron al abrir la página (no la de lo que se tildó): el servidor guarda solo si no cambiaron. */}
        <input type="hidden" name="permissions_version" value={permissionsVersion(initial)} />
        <PermissionChecklist value={permissions} onChange={setPermissions} />
        <SavePermissionsButton />
        <Feedback state={state} />
      </form>
    </details>
  );
}
