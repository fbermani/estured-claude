import type { ComponentPropsWithoutRef } from "react";

/**
 * Material Symbols Outlined (design-references/fresh-style.md §1.2) —
 * librería de íconos única del proyecto, cargada en app/layout.tsx.
 * `name` es el nombre del ícono en el catálogo de Google
 * (https://fonts.google.com/icons), ej. "home", "search", "person".
 * Decorativo por defecto (aria-hidden) — si el ícono es el único
 * contenido de un control interactivo, poné aria-label en el elemento
 * padre (button/link), no acá.
 */
export function Icon({
  name,
  className = "",
  ...props
}: { name: string } & ComponentPropsWithoutRef<"span">) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`} {...props}>
      {name}
    </span>
  );
}
