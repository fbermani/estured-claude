import type { ReactNode } from "react";

/** Píldora «Acceso anticipado» (DR47.2): naranja plano con punto pulsante (el anillo se apaga con prefers-reduced-motion). */
export function EarlyAccessPill({ children = "Acceso anticipado abierto" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-orange py-2 pl-3 pr-4 text-sm font-bold text-white shadow-orange">
      <span aria-hidden="true" className="pre-dot size-2.5 rounded-full bg-white text-white" />
      {children}
    </span>
  );
}
