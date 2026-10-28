"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { setResidentEmailAction, type ResidentsActionState } from "@/app/residence/[residence_id]/residents/actions";
import { buildResidentInviteMessage, buildResidentInviteWhatsappUrl } from "@/lib/residents/inviteMessage";

const initialState: ResidentsActionState = { status: "idle" };

/**
 * Residente cargado sin mail (DR18 t4, punto 20): se le carga el mail cuando la residencia lo tenga y, mientras tanto, se puede
 * compartir el mensaje de registro por WhatsApp. El envío es MANUAL (abre wa.me con el texto armado); no hay API de WhatsApp.
 */
export function NoEmailResidentBlock({
  residenceId,
  stayId,
  residenceName,
  phone,
}: {
  residenceId: string;
  stayId: string;
  residenceName: string;
  phone: string | null;
}) {
  const action = setResidentEmailAction.bind(null, residenceId, stayId);
  const [state, formAction, pending] = useActionState(action, initialState);

  function share() {
    const message = buildResidentInviteMessage({ residenceName, registerUrl: `${window.location.origin}/register/student` });
    window.open(buildResidentInviteWhatsappUrl(message, phone), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-field border border-line bg-paper p-4 sm:col-span-2 lg:col-span-4">
      <p className="text-sm font-bold text-ink">Residente sin activar (sin mail)</p>
      <p className="mt-1 text-xs text-ink-soft">
        Cuando tengas su mail, cargalo acá: se registra en EstuRed con ese mismo mail y su perfil se vincula a esta estadía.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Input label="Email del residente" name="email" type="email" required />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar mail"}
        </Button>
        <button
          type="button"
          onClick={share}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
        >
          <Icon name="send" className="text-base" /> Compartir por WhatsApp
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="mt-2 text-sm font-medium text-forest-700">Mail guardado.</p>}
    </div>
  );
}
