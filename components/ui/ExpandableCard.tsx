"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

/**
 * Card resumen + detalle expandible — misma técnica de animación que
 * `FaqAccordion` (grid-template-rows 0fr→1fr + wrapper overflow-hidden,
 * duration-300 ease-fresh) pero cada instancia abre/cierra en forma
 * independiente (no es "una sola abierta a la vez" como el FAQ, porque
 * acá cada card es una entidad propia — solicitud, lista de espera,
 * renovación — no una pregunta entre varias). Ciclo 38: reemplaza la
 * navegación a pantallas de detalle por expansión in-place.
 */
export function ExpandableCard({
  summary,
  children,
  defaultOpen = false,
  className = "",
  tone,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Tono del rol (kit logueado): borde izquierdo, apertura y foco. Sin tono se ve como siempre (forest). */
  tone?: RoleTone;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${toneClass(tone)} overflow-hidden rounded-card border-[1.5px] border-line bg-paper transition-shadow duration-200 ease-out-fresh hover:shadow-card-hover ${tone ? "border-l-[5px] border-l-(--tone)" : ""} ${open ? "border-(--tone)/40" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <Icon
          name="expand_more"
          className={`shrink-0 text-2xl text-ink-faint transition-transform duration-300 ease-fresh ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-fresh"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line px-5 pb-5 pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
