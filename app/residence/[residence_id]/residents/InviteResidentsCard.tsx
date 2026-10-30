"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { buildResidentInviteMessage, buildResidentInviteWhatsappUrl } from "@/lib/residents/inviteMessage";

/**
 * Guía para que los residentes se creen la cuenta y se vinculen (DR18 punto 20). Compartir es
 * MANUAL: abre wa.me con el texto armado; no hay integración con la API de WhatsApp.
 */
export function InviteResidentsCard({ residenceName }: { residenceName: string }) {
  const [copied, setCopied] = useState<"msg" | "link" | null>(null);
  const registerUrl = () => `${window.location.origin}/register/student`;
  const message = () => buildResidentInviteMessage({ residenceName, registerUrl: registerUrl() });

  async function copy(kind: "msg" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "msg" ? message() : registerUrl());
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const btn =
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-2 px-4 text-sm font-bold text-ink-soft hover:border-(--tone) hover:text-(--tone-700) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)";

  return (
    <Card className="mb-6 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-(--tone-tint) text-(--tone-700)"><Icon name="forum" className="text-2xl" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Invitá a tus residentes a crear su cuenta</h2>
          <p className="mt-1 text-sm text-ink-soft">Mandá el mensaje al grupo o a cada uno, así se registran con el mismo mail con el que los cargues.</p>
          <details className="group mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-(--tone-700) marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) [&::-webkit-details-marker]:hidden">
              Más detalle
              <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <p className="benefit-fade-in text-xs text-ink-faint">
              Así su perfil se vincula solo a su estadía y vos solo ordenás habitaciones y completás contratos. Si cargás a alguien solo con nombre y apellido, queda como «residente sin activar» hasta que active su cuenta o relacionemos su perfil. El envío lo hacés vos, a mano: EstuRed no manda mensajes por WhatsApp.
            </p>
          </details>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(buildResidentInviteWhatsappUrl(message()), "_blank", "noopener,noreferrer")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-(--tone) px-4 text-sm font-bold text-white transition-all duration-300 ease-bounce hover:-translate-y-px hover:bg-(--tone-600) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
            >
              <Icon name="send" className="text-base" /> Compartir por WhatsApp
            </button>
            <button type="button" onClick={() => copy("msg")} className={btn}>
              <Icon name="content_copy" className="text-base" /> {copied === "msg" ? "Mensaje copiado" : "Copiar mensaje"}
            </button>
            <button type="button" onClick={() => copy("link")} className={btn}>
              <Icon name="link" className="text-base" /> {copied === "link" ? "Link copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
