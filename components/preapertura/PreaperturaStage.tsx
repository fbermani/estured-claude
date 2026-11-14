"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { BlurredPreview } from "@/components/preapertura/BlurredPreview";
import { PreaperturaDialog } from "@/components/preapertura/PreaperturaDialog";
import { isDevUi } from "@/lib/dev/devUi";

const IS_DEV = isDevUi();
/** Solo desarrollo: el popup cerrado se recuerda entre pantallas (sessionStorage) hasta que se aprieta «Volver al popup». */
const REVEAL_KEY = "estured:pre-dev-revealed";
const REVEAL_EVENT = "estured:pre-dev-revealed-change";

function subscribeReveal(cb: () => void) {
  window.addEventListener(REVEAL_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(REVEAL_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readRevealed() {
  try {
    return window.sessionStorage.getItem(REVEAL_KEY) === "1";
  } catch {
    return false;
  }
}
function writeRevealed(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(REVEAL_KEY, "1");
    else window.sessionStorage.removeItem(REVEAL_KEY);
  } catch {
    /* sin almacenamiento: vale solo hasta cambiar de pantalla */
  }
  window.dispatchEvent(new Event(REVEAL_EVENT));
}

/**
 * Escenario de toda pantalla de preapertura: landing real de fondo (`preview`, blureada con una capa fija) + popup (`children`). El fondo
 * está en flujo normal: el documento se desplaza y el popup queda flotando (capa fija sin eventos de puntero salvo el diálogo).
 *
 * Solo en DESARROLLO el popup se puede ocultar con «Cerrar (solo dev)» para ver y recorrer la landing sin blur; un botón
 * «Volver al popup (solo dev)» lo trae de vuelta. El estado se recuerda en la sesión: cerrado, el popup no reaparece al pasar a otra
 * pantalla hasta apretar ese botón. En producción `IS_DEV` es false y ese estado nunca cambia: el popup es permanente.
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
  const devRevealed = useSyncExternalStore(subscribeReveal, readRevealed, () => false);
  const revealed = IS_DEV && devRevealed;

  return (
    <div className="bg-cream">
      <BlurredPreview revealed={revealed} label={previewLabel}>{preview}</BlurredPreview>
      {revealed ? (
        <button
          type="button"
          onClick={() => writeRevealed(false)}
          className="fixed left-4 top-[7.5rem] z-[60] inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-paper bg-forest-ink px-4 text-sm font-bold whitespace-nowrap text-paper shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)]"
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
          onDevClose={IS_DEV ? () => writeRevealed(true) : undefined}
          aside={aside}
        >
          {children}
        </PreaperturaDialog>
      )}
    </div>
  );
}
