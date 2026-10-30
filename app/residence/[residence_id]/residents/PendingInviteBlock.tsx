"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import {
  generateWhatsappInviteAction,
  resendInvitationAction,
  setResidentEmailAction,
  type ResidentsActionState,
} from "@/app/residence/[residence_id]/residents/actions";

const initialState: ResidentsActionState = { status: "idle" };

export type InviteChip = { label: string; tone: "neutral" | "ok" | "warn" | "bad" };

/** Chip de estado de la última invitación (puro, sin PII). */
export function inviteChipFor(state: string, channel: string | null, hasEmail: boolean): InviteChip {
  switch (state) {
    case "open":
      return { label: channel === "whatsapp" ? "Enlace generado para WhatsApp" : "Invitación enviada", tone: "ok" };
    case "expired":
      return { label: "La invitación venció", tone: "warn" };
    case "declined":
      return { label: "Dijo que no vive ahí / no es él o ella", tone: "bad" };
    case "revoked":
      return { label: "Enlace reemplazado", tone: "neutral" };
    default:
      return { label: hasEmail ? "Sin invitación enviada" : "Sin mail ni invitación", tone: "neutral" };
  }
}

const toneClass: Record<InviteChip["tone"], string> = {
  neutral: "bg-cream-2 text-ink-soft",
  ok: "bg-forest-tint text-forest-700",
  warn: "bg-warning-bg text-warning-fg",
  bad: "bg-danger-bg text-danger-fg",
};

const secondaryBtn =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700 disabled:opacity-50";

/**
 * Residente sin cuenta vinculada (DR19): estado de su invitación personal y las acciones para moverla. Un botón por persona:
 * «Reenviar» por mail (genera un enlace nuevo y el anterior deja de servir) y «WhatsApp» (abre wa.me con su enlace personal; el envío lo
 * hacés vos, a mano: EstuRed no usa la API de WhatsApp). El mail se puede corregir mientras no haya cuenta vinculada.
 */
export function PendingInviteBlock({
  residenceId,
  stayId,
  email,
  inviteState,
  inviteChannel,
}: {
  residenceId: string;
  stayId: string;
  email: string | null;
  inviteState: string;
  inviteChannel: string | null;
}) {
  const [emailState, emailAction, emailPending] = useActionState(setResidentEmailAction.bind(null, residenceId, stayId), initialState);
  const [resendState, resendAction, resendPending] = useActionState(resendInvitationAction.bind(null, residenceId, stayId), initialState);
  const [waPending, startWa] = useTransition();
  const [waState, setWaState] = useState<ResidentsActionState>(initialState);
  const chip = inviteChipFor(inviteState, inviteChannel, !!email);

  function shareWhatsapp() {
    // Se abre la pestaña en el clic (los navegadores bloquean ventanas abiertas después de un await) y se completa con el wa.me.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    startWa(async () => {
      const result = await generateWhatsappInviteAction(residenceId, stayId, initialState);
      setWaState(result);
      if (result.status === "saved" && result.waUrl && tab) tab.location.href = result.waUrl;
      else tab?.close();
    });
  }

  const feedback = [emailState, resendState, waState].find((s) => s.status !== "idle");

  return (
    <div className="rounded-field border border-line bg-paper p-4 sm:col-span-2 lg:col-span-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-ink">{email ? "Pendiente de activar" : "Residente sin activar (sin mail)"}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${toneClass[chip.tone]}`}>{chip.label}</span>
      </div>
      {inviteState === "declined" ? (
        <p className="mt-1 text-xs text-ink-soft">Avisó que no vive ahí o que no es esa persona. Revisá el mail cargado y, si corresponde, mandá una invitación nueva.</p>
      ) : (
        <p className="mt-1 text-xs text-ink-soft">
          {email ? `Mail cargado: ${email}. ` : ""}Su enlace personal es de un solo uso y vence a los 14 días; al reenviarlo, el anterior deja de servir.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {email && (
          <form action={resendAction}>
            <Button type="submit" size="sm" variant="outline" disabled={resendPending}>
              {resendPending ? "Enviando…" : "Reenviar invitación"}
            </Button>
          </form>
        )}
        <button type="button" onClick={shareWhatsapp} disabled={waPending} className={secondaryBtn}>
          <Icon name="send" className="text-base" /> {waPending ? "Preparando…" : "Mandar por WhatsApp"}
        </button>
      </div>

      <details className="mt-3" open={!email}>
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">{email ? "Corregir el mail" : "Cargar el mail"}</summary>
        <form action={emailAction} className="mt-2 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input label="Email del residente" name="email" type="email" required />
          </div>
          <Button type="submit" size="sm" disabled={emailPending}>
            {emailPending ? "Guardando…" : "Guardar mail y enviar"}
          </Button>
        </form>
        {email && <p className="mt-1 text-xs text-ink-faint">Cambiarlo invalida el enlace anterior y manda uno nuevo al mail nuevo.</p>}
      </details>

      {feedback?.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
          {feedback.message}
        </p>
      )}
      {feedback?.status === "saved" && feedback.message && <p className="mt-2 text-sm font-medium text-forest-700">{feedback.message}</p>}
    </div>
  );
}
