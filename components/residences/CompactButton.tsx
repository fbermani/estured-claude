import type { ComponentPropsWithoutRef } from "react";

/**
 * Botón secundario compacto (36 px de alto visibles) para acciones que se repiten en una lista, como el «Guardar» de cada pregunta.
 * El área táctil sigue en 44 px: el pseudo-elemento suma 4 px arriba y abajo. La acción primaria de la pantalla va con `Button`.
 */
export function CompactButton({ className = "", children, type = "button", ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type={type}
      {...props}
      className={`relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-sm font-bold text-ink transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
