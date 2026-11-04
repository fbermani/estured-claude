"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import {
  inviteFamilyMember,
  cancelFamilyInvitation,
  revokeFamilyLink,
  type FamilyInviteState,
} from "@/app/students/family-link-actions";

const inviteInitial: FamilyInviteState = { status: "idle" };

/**
 * Formulario de invitación en su propio componente, con `useActionState`
 * propio — así el padre lo puede remontar con un `key` que cambia al
 * cancelar una invitación anterior. Sin esto, cancelar y volver al
 * formulario vacío dejaba pegado el mensaje "Invitación enviada." de la
 * invitación ya cancelada (el hook nunca se desmonta si solo cambia la
 * rama del JSX que lo envuelve, encontrado verificando en vivo).
 */
function InviteForm() {
  const [inviteState, inviteAction, isInviting] = useActionState(inviteFamilyMember, inviteInitial);
  return (
    <>
      <form action={inviteAction} className="mt-3 flex flex-col gap-2">
        <Input
          id="family-invite-email"
          name="email"
          type="email"
          required
          placeholder="email@ejemplo.com"
          maxLength={200}
        />
        <Button type="submit" variant="outline" size="sm" disabled={isInviting}>
          {isInviting ? "Enviando…" : "Enviar invitación"}
        </Button>
      </form>
      {inviteState.status === "error" && (
        <p className="mt-1.5 text-xs font-medium text-danger-fg">{inviteState.message}</p>
      )}
      {inviteState.status === "sent" && (
        <p className="benefit-fade-in mt-1.5 text-xs font-medium text-forest-700">Invitación enviada.</p>
      )}
    </>
  );
}

/**
 * "Vinculación parental" en Mi perfil (Ciclo 37) — 3 estados posibles:
 * ya vinculado (con desvincular), invitación pendiente (con cancelar),
 * o el formulario para invitar por email. El estado intermedio
 * "solicitud pendiente de TU aprobación" (el familiar ya se registró)
 * no se resuelve acá — reusa el flujo de aprobación que ya existe en
 * /students/dashboard (`FamilyLinkActions.tsx`) en vez de duplicarlo.
 */
export function FamilyLinkCard({
  activeLink,
  pendingApprovalCount,
  pendingInvitation,
  isMinor = false,
}: {
  activeLink: { id: string; name: string; email: string | null } | null;
  pendingApprovalCount: number;
  pendingInvitation: { id: string; email: string } | null;
  /** Menor de 18: el familiar vinculado es obligatorio para enviar solicitudes (docs/10 §9.1). */
  isMinor?: boolean;
}) {
  const [isRevoking, startRevoke] = useTransition();
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isCancelling, startCancel] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);

  function handleRevoke() {
    if (!activeLink) return;
    setRevokeError(null);
    startRevoke(async () => {
      const result = await revokeFamilyLink(activeLink.id);
      if (result.status === "error") setRevokeError(result.message ?? "Ocurrió un error.");
    });
  }

  function handleCancelInvitation() {
    if (!pendingInvitation) return;
    setCancelError(null);
    startCancel(async () => {
      const result = await cancelFamilyInvitation(pendingInvitation.id);
      if (result.status === "error") setCancelError(result.message ?? "Ocurrió un error.");
      else setFormEpoch((e) => e + 1);
    });
  }

  return (
    <div className="flex h-full flex-col rounded-card border-[1.5px] border-line bg-paper p-[18px] shadow-card transition duration-200 ease-out-fresh hover:-translate-y-1 hover:shadow-card-hover focus-within:-translate-y-1">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-(--tone-tint) text-(--tone-700)">
          <Icon name="family_restroom" className="text-2xl" />
        </span>
        <h3 className="font-display text-[16.5px] font-bold leading-tight text-ink">Padre, madre o tutor</h3>
      </div>

      {pendingApprovalCount > 0 ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Tenés {pendingApprovalCount === 1 ? "una solicitud de vinculación" : `${pendingApprovalCount} solicitudes de vinculación`} esperando tu aprobación.
          </p>
          <Link
            href="/students/dashboard"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline"
          >
            Revisarla en tu panel
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
        </>
      ) : activeLink ? (
        <>
          <div className="mt-3 rounded-field border border-line bg-paper p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success-fg">
              <Icon name="check_circle" className="text-sm" /> Vinculado
            </p>
            <p className="mt-1 text-sm font-bold text-ink">{activeLink.name}</p>
            {activeLink.email && <p className="text-xs text-ink-faint">{activeLink.email}</p>}
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isRevoking}
            className="mt-1 inline-flex min-h-11 items-center self-start text-xs font-semibold text-danger-fg hover:underline disabled:opacity-50"
          >
            {isRevoking ? "Desvinculando…" : "Desvincular"}
          </button>
          {revokeError && <p className="mt-1.5 text-xs font-medium text-danger-fg">{revokeError}</p>}
        </>
      ) : pendingInvitation ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Invitación enviada a <span className="font-semibold text-ink">{pendingInvitation.email}</span> — esperando
            que se registre.
          </p>
          <button
            type="button"
            onClick={handleCancelInvitation}
            disabled={isCancelling}
            className="mt-1 inline-flex min-h-11 items-center self-start text-xs font-semibold text-ink-faint hover:text-danger-fg hover:underline disabled:opacity-50"
          >
            {isCancelling ? "Cancelando…" : "Cancelar invitación"}
          </button>
          {cancelError && <p className="mt-1.5 text-xs font-medium text-danger-fg">{cancelError}</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            {isMinor
              ? "Siendo menor de 18, necesitás un familiar vinculado para enviar solicitudes. Vos aprobás la vinculación."
              : "Invitá a tu familiar por email para que te acompañe. Vos seguís decidiendo todo."}
          </p>
          <InviteForm key={formEpoch} />
          {!isMinor && (
            <details className="group mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-(--tone-700) marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) [&::-webkit-details-marker]:hidden">
                Qué puede hacer
                <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="benefit-fade-in text-xs text-ink-soft">Va a poder ver tu búsqueda, sugerir residencias y ayudarte con pagos y documentación.</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
