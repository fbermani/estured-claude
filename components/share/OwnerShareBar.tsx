import { Suspense } from "react";
import { Icon } from "@/components/ui/Icon";
import { ShareFichaSheetServer } from "@/components/share/ShareFichaSheetServer";

/**
 * Franja «Esta es tu ficha pública» (mockup aprobado, vista «Residencia (dueño)»): se dibuja SOLO para el equipo de ESTA residencia
 * (la ficha ya resolvió el vínculo con `assertResidenceAccess`; `ShareFichaSheetServer` lo vuelve a validar y no arma nada para nadie
 * más). El botón «Compartir esta ficha» es secundario (borde, sin relleno): la única acción primaria de la ficha sigue siendo la CTA
 * naranja del hero. La hoja se carga dentro de `Suspense`, así que no demora el resto de la página; mientras llega se ve el mismo
 * botón apagado.
 */
export function OwnerShareBar({ residenceId }: { residenceId: string }) {
  return (
    <div role="region" aria-label="Herramientas de la residencia" className="border-b-[1.5px] border-line-2 bg-forest-tint">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="min-w-0 text-sm text-forest-700">
          <strong className="font-bold">Esta es tu ficha pública.</strong> Mandala como primer mensaje y ahorrate las preguntas de siempre.
        </p>
        <Suspense fallback={<PendingButton />}>
          <ShareFichaSheetServer residenceId={residenceId} />
        </Suspense>
      </div>
    </div>
  );
}

function PendingButton() {
  return (
    <button
      type="button"
      disabled
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-line-2 bg-paper px-5 text-sm font-bold text-ink opacity-60"
    >
      <Icon name="share" className="text-lg" />
      Compartir esta ficha
    </button>
  );
}
