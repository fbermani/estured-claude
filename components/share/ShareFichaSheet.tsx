"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ShareMessageEditor } from "@/components/share/ShareMessageEditor";
import type { SharePlaceholderKey } from "@/lib/share/resolveShareMessage";

/**
 * Hoja «Compartir esta ficha»: la residencia (equipo) ve el mensaje de WhatsApp resuelto y lo comparte sin salir de su ficha pública.
 * Comparte el editor con la página del panel (`/residence/[id]/share`). Se monta con `ShareFichaSheetServer`, que carga los datos y
 * resuelve el permiso. Es un botón manual (`wa.me`): nunca la API de WhatsApp Business.
 */
export function ShareFichaSheet({
  residenceId,
  initialTemplate,
  defaultTemplate,
  initialIsCustom,
  values,
  link,
  canEdit,
  schemaReady,
  triggerLabel = "Compartir esta ficha",
}: {
  residenceId: string;
  initialTemplate: string;
  defaultTemplate: string;
  initialIsCustom: boolean;
  values: Record<SharePlaceholderKey, string | null>;
  link: string;
  canEdit: boolean;
  schemaReady: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-line-2 bg-paper px-5 text-sm font-bold text-ink transition hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="share" className="text-lg" />
        {triggerLabel}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} placement="side">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            Compartir esta ficha
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <ShareMessageEditor
            residenceId={residenceId}
            initialTemplate={initialTemplate}
            defaultTemplate={defaultTemplate}
            initialIsCustom={initialIsCustom}
            values={values}
            link={link}
            canEdit={canEdit}
            schemaReady={schemaReady}
            stacked
          />
        </div>
      </Dialog>
    </>
  );
}
