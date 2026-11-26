"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { SealIntro } from "@/components/brand/SealIntro";
import { BlurredPreview } from "@/components/preapertura/BlurredPreview";
import { PreaperturaDialog } from "@/components/preapertura/PreaperturaDialog";
import { isDevUi } from "@/lib/dev/devUi";

const IS_DEV = isDevUi();
/**
 * Solo desarrollo: el popup cerrado se recuerda SOLO en memoria, mientras se recorren pantallas sin recargar. No se guarda en
 * el navegador: al actualizar, reabrir la página, volver desde el historial o entrar al home, el popup vuelve a abrirse.
 */
const REVEAL_EVENT = "estured:pre-dev-revealed-change";
let revealedInMemory = false;
/**
 * Apertura de entrada: el sello se ve ANTES que el popup, solo en la carga de la página (viene en el HTML del servidor, así cubre
 * desde el primer cuadro). Al pasar de una pantalla de la preapertura a otra sin recargar no se repite. Vive en memoria: recargar
 * la página la vuelve a mostrar.
 */
let entryIntroShown = false;

function subscribeReveal(cb: () => void) {
  window.addEventListener(REVEAL_EVENT, cb);
  return () => window.removeEventListener(REVEAL_EVENT, cb);
}
function readRevealed() {
  return revealedInMemory;
}
function writeRevealed(on: boolean) {
  if (revealedInMemory === on) return;
  revealedInMemory = on;
  window.dispatchEvent(new Event(REVEAL_EVENT));
}

/**
 * Escenario de toda pantalla de preapertura: landing real de fondo (`preview`, blureada con una capa fija) + popup (`children`). El fondo
 * está en flujo normal: el documento se desplaza y el popup queda flotando (capa fija sin eventos de puntero salvo el diálogo).
 *
 * Solo en DESARROLLO el popup se puede ocultar con «Cerrar (solo dev)» para ver y recorrer la landing sin blur; un botón
 * «Volver al popup (solo dev)» lo trae de vuelta. Cerrado, el popup no reaparece al pasar a otra pantalla (sin recargar) hasta
 * apretar ese botón, pero siempre vuelve a abrirse al actualizar, reabrir la página o volver al home. En producción `IS_DEV` es false y ese estado nunca cambia: el popup es permanente.
 */
export function PreaperturaStage({
  preview,
  children,
  labelledBy,
  describedBy,
  size,
  initialFocus,
  aside,
  asideBeside,
  fullOnMobile,
  previewLabel,
}: {
  preview: ReactNode;
  children: ReactNode;
  labelledBy: string;
  describedBy?: string;
  size?: "sm" | "entry" | "md" | "mid" | "lugar" | "form" | "wide" | "lg";
  initialFocus?: string;
  aside?: ReactNode;
  /** La lateral va al lado de la caja desde 1100 px (ver `PreaperturaDialog`). */
  asideBeside?: boolean;
  /** En celular el popup ocupa toda la pantalla (ver `PreaperturaDialog`). */
  fullOnMobile?: boolean;
  /** Etiqueta fija arriba a la izquierda del fondo blureado. Sin valor, no se muestra. */
  previewLabel?: string;
}) {
  const pathname = usePathname();
  /** Cada cierre (solo dev) dispara la apertura con el sello sobre toda la pantalla. */
  const [introRun, setIntroRun] = useState(0);
  /** En la hidratación vale true (igual que el HTML del servidor); en una navegación sin recarga, false. */
  const [entryIntro] = useState(() => !entryIntroShown);
  useEffect(() => {
    entryIntroShown = true;
  }, []);
  const devRevealed = useSyncExternalStore(subscribeReveal, readRevealed, () => false);

  // Volver al home (navegación sin recarga) reinicia el popup, antes de pintar.
  useLayoutEffect(() => {
    if (pathname === "/") writeRevealed(false);
  }, [pathname]);
  // Volver desde el historial con la página en caché (bfcache) también lo reinicia.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) writeRevealed(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const revealed = IS_DEV && devRevealed;

  return (
    <div className="bg-cream">
      {entryIntro && introRun === 0 && <SealIntro fixed blocking />}
      {introRun > 0 && <SealIntro key={introRun} fixed />}
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
          onDevClose={
            IS_DEV
              ? () => {
                  setIntroRun((n) => n + 1);
                  writeRevealed(true);
                }
              : undefined
          }
          aside={aside}
          asideBeside={asideBeside}
          fullOnMobile={fullOnMobile}
        >
          {children}
        </PreaperturaDialog>
      )}
    </div>
  );
}
