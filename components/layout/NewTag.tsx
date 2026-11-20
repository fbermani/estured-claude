/**
 * Etiqueta «Nuevo» de un ítem de menú (solo presentación; el texto es parte del nombre accesible del enlace). Sin `"use client"`:
 * se usa desde el sidebar y desde la hoja «Más» de la barra móvil. Naranja sobre su tinte (contraste AA).
 */
export function NewTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold leading-4 text-orange-700 ${className}`}>
      Nuevo
    </span>
  );
}
