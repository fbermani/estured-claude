"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { buildResidentInviteMessage, buildResidentInviteWhatsappUrl } from "@/lib/residents/inviteMessage";

/** Contenedor: tarjeta suelta o panel compacto dentro del encabezado. */
function Shell({ panel, children }: { panel: boolean; children: React.ReactNode }) {
  return panel ? (
    <div className="h-full rounded-card border border-white/70 bg-white/80 p-4 shadow-card">{children}</div>
  ) : (
    <Card className="mb-6 p-5">{children}</Card>
  );
}

/**
 * Guía para que los residentes se creen la cuenta y se vinculen (DR18 punto 20). Compartir es
 * MANUAL: abre wa.me con el texto armado; no hay integración con la API de WhatsApp.
 */
export function InviteResidentsCard({ residenceName, variant = "card" }: { residenceName: string; variant?: "card" | "panel" }) {
  const panel = variant === "panel";
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
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] md:min-h-10 border-line-2 px-3.5text-sm font-bold text-ink-soft hover:border-(--tone) hover:text-(--tone-700) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)";


  return (
    <Shell panel={panel}>
      <div className="flex items-start gap-3">
        <span className={`flex shrink-0 items-center justify-center rounded-field bg-(--tone-tint) text-(--tone-700) ${panel ? "size-10" : "size-11"}`}><Icon name="forum" className={panel ? "text-xl" : "text-2xl"} /></span>
        <div className="min-w-0 flex-1">
          <h2 className={`font-bold text-ink ${panel ? "text-[15px]" : ""}`}>Invitá a tus residentes a crear su cuenta</h2>
          <p className={`mt-0.5 text-ink-soft ${panel ? "text-[13px] leading-snug" : "mt-1 text-sm"}`}>Mandá el mensaje al grupo o a cada uno, así se registran con el mismo mail con el que los cargues.</p>
          <details className={`group ${panel ? "" : "mt-1"}`}>
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-(--tone-700) marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) [&::-webkit-details-marker]:hidden">
              Más detalle
              <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <p className="benefit-fade-in text-xs text-ink-faint">
              Así su perfil se vincula solo a su estadía y vos solo ordenás habitaciones y completás contratos. Si cargás a alguien solo con nombre y apellido, queda como «residente sin activar» hasta que active su cuenta o relacionemos su perfil. El envío lo hacés vos, a mano: EstuRed no manda mensajes por WhatsApp.
            </p>
          </details>
          <div className={`flex flex-wrap ${panel ? "mt-2 gap-1.5" : "mt-3 gap-2"}`}>
            <button
              type="button"
              onClick={() => window.open(buildResidentInviteWhatsappUrl(message()), "_blank", "noopener,noreferrer")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-(--tone) md:min-h-10 px-4 text-sm font-bold text-white transition duration-200 ease-out-fresh motion-safe:active:scale-[0.97] hover:-translate-y-px hover:bg-(--tone-600) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
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
    </Shell>
  );
}
