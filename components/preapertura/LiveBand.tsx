import type { ReactNode } from "react";

/**
 * Banda «en vivo» de los popups de preapertura (DR67 e): un brillo la barre y el punto emite un anillo. Solo `transform` y
 * `opacity`; con prefers-reduced-motion quedan quietos (`preapertura.css`).
 */
export function LiveBand({ children }: { children: ReactNode }) {
  return (
    <p className="pre-live relative flex items-center justify-center gap-3 overflow-hidden bg-orange px-4 text-center font-bold text-paper">
      <span aria-hidden="true" className="pre-dot size-3 shrink-0 rounded-full bg-paper text-paper" />
      {children}
    </p>
  );
}
