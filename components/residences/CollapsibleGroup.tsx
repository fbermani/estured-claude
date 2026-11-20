"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Grupo colapsable (`<details>` controlado desde afuera), el mismo patrón que los grupos de universidades de la configuración.
 * El contenido sigue MONTADO aunque el grupo esté cerrado: lo escrito en sus campos no se pierde y el padre puede leerlo.
 * El `open` se maneja en React: sin el `preventDefault` el navegador lo cambia por su cuenta y el estado queda desfasado.
 */
export function CollapsibleGroup({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  /** Lo que se ve a la derecha del título (contadores, avisos). */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group rounded-card border-[1.5px] border-line bg-cream-2/40">
      <summary
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <span className="min-w-0 text-sm font-bold text-ink">{title}</span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {summary}
          <Icon name="expand_more" aria-hidden className="text-xl text-ink-soft motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180" />
        </span>
      </summary>
      {children}
    </details>
  );
}
