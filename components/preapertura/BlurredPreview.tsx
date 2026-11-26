import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Fondo de la preapertura (DR42.5): la landing real de EstuRed en FLUJO NORMAL (scroll del documento), fuera del árbol accesible
 * (`aria-hidden` + `inert`: no recibe foco, clics ni lectores de pantalla; `inert` no impide que el documento se desplace). El blur
 * y el velo son una capa FIJA con `backdrop-filter` que cubre el viewport, sin eventos de puntero: la rueda, el trackpad, el touch y
 * el teclado desplazan la página de atrás mientras el popup queda flotando. La etiqueta fija arriba a la izquierda solo aparece si la pantalla
 * pasa `label` (hoy, «Mi lugar»).
 * `revealed` solo lo enciende el botón «Cerrar (solo dev)» del popup (ver PreaperturaDialog): en producción nunca es true.
 */
export function BlurredPreview({ revealed = false, label, children }: { revealed?: boolean; label?: string; children: ReactNode }) {
  return (
    <>
      <div aria-hidden={revealed ? undefined : true} inert={!revealed} className={revealed ? "" : "select-none"}>
        {children}
      </div>
      {!revealed && (
        <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 bg-forest-ink/30 backdrop-blur-[6px] backdrop-saturate-[.92]" />
          {label && (
            <p
              aria-hidden="true"
              className="pointer-events-none fixed left-4 top-3.5 z-[55] inline-flex items-center gap-1.5 rounded-full bg-forest-ink/85 px-3 py-1.5 text-xs font-bold text-white"
            >
              <Icon name="lock" className="text-base text-gold" />
              {label}
            </p>
          )}
        </>
      )}
    </>
  );
}
