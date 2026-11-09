import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Fondo de la preapertura (DR42.5): la landing de preapertura completa, blureada y fuera del árbol accesible
 * (`aria-hidden` + `inert`: no recibe foco, clics ni lectores de pantalla), con scroll propio y la etiqueta «Así se va a ver
 * EstuRed». `revealed` solo lo enciende el botón «Cerrar (solo dev)» del popup (ver PreaperturaDialog): en producción nunca es true.
 * Vive dentro de un contenedor posicionado (PreaperturaStage) y ocupa todo su alto.
 */
export function BlurredPreview({ revealed = false, label = "Así se va a ver EstuRed", children }: { revealed?: boolean; label?: string; children: ReactNode }) {
  return (
    <>
      <div
        aria-hidden={revealed ? undefined : true}
        inert={!revealed}
        className={`absolute inset-0 overflow-y-auto overflow-x-hidden ${
          revealed ? "" : "scale-[1.015] blur-[6px] saturate-[.92] select-none [scrollbar-width:none]"
        }`}
      >
        {children}
      </div>
      {!revealed && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-forest-ink/30" />
          <p
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-3.5 z-[3] inline-flex items-center gap-1.5 rounded-full bg-forest-ink/85 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Icon name="lock" className="text-base text-gold" />
            {label}
          </p>
        </>
      )}
    </>
  );
}
