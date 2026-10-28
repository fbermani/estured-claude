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
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700";

  return (
    <Card className="mb-6 p-5">
      <div className="flex items-start gap-3">
        <Icon name="forum" className="mt-0.5 text-2xl text-forest-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Invitá a tus residentes a crear su cuenta</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Lo más simple es mandar un mensaje al grupo de WhatsApp de la residencia, o a cada residente, para que se
            registren en EstuRed con el mismo email con el que los cargues. Así su perfil se vincula solo a su estadía y
            vos solo ordenás las habitaciones y completás contratos y estadías.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Si cargás a alguien solo con nombre y apellido, queda como «residente sin activar» hasta que active su cuenta
            o relacionemos su perfil. El envío lo hacés vos, a mano: EstuRed no manda mensajes por WhatsApp.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(buildResidentInviteWhatsappUrl(message()), "_blank", "noopener,noreferrer")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600"
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
