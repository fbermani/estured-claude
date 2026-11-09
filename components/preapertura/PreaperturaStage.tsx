"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { BlurredPreview } from "@/components/preapertura/BlurredPreview";
import { PreaperturaDialog } from "@/components/preapertura/PreaperturaDialog";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Escenario de toda pantalla de preapertura: landing blureada de fondo (`preview`) + popup (`children`). Pantalla completa fija:
 * el scroll es el del fondo y el popup flota encima.
 *
 * Solo en DESARROLLO el popup se puede ocultar con «Cerrar (solo dev)» para ver y recorrer la landing sin blur; un botón
 * «Volver al popup (solo dev)» lo trae de vuelta. En producción `IS_DEV` es false y ese estado nunca cambia: el popup es permanente.
 */
export function PreaperturaStage({
  preview,
  children,
  labelledBy,
  describedBy,
  size,
  initialFocus,
  aside,
  previewLabel,
}: {
  preview: ReactNode;
  children: ReactNode;
  labelledBy: string;
  describedBy?: string;
  size?: "sm" | "md" | "mid" | "lugar" | "form" | "wide" | "lg";
  initialFocus?: string;
  aside?: ReactNode;
  /** Etiqueta fija arriba a la izquierda del fondo blureado (por defecto «Así se va a ver EstuRed»). */
  previewLabel?: string;
}) {
  const [devRevealed, setDevRevealed] = useState(false);
  const revealed = IS_DEV && devRevealed;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-cream">
      <BlurredPreview revealed={revealed} label={previewLabel}>{preview}</BlurredPreview>
      {revealed ? (
        <button
          type="button"
          onClick={() => setDevRevealed(false)}
          className="fixed right-4 top-3.5 z-[60] inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-paper bg-forest-ink px-4 text-sm font-bold whitespace-nowrap text-paper shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)]"
        >
          <Icon name="open_in_new" className="text-lg" />
          Volver al popup (solo dev)
        </button>
      ) : (
        <PreaperturaDialog
          labelledBy={labelledBy}
          describedBy={describedBy}
          size={size}
          initialFocus={initialFocus}
          onDevClose={IS_DEV ? () => setDevRevealed(true) : undefined}
          aside={aside}
        >
          {children}
        </PreaperturaDialog>
      )}
    </div>
  );
}
