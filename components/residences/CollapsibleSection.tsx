"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SectionStatusTone } from "@/lib/residences/photoSectionCollapse";

const TONE_CLASS: Record<SectionStatusTone, string> = {
  neutral: "bg-cream-2 text-ink-soft",
  warning: "bg-orange-tint text-orange-700",
  danger: "bg-danger-bg text-danger-fg",
};

/**
 * Sección colapsable controlada: cabecera con un botón (`aria-expanded` + `aria-controls`) y cuerpo que SIEMPRE queda montado
 * (se oculta con `hidden`), así el estado interno de sus hijos —subidas, borrados, edición— no se pierde al cerrarla.
 * El cuerpo no se anima (ni alto ni ancho): aparece y desaparece de una vez; el chevron solo rota con `transform`.
 * `actions` va fuera del botón (p. ej. «Subir»): no se puede anidar un control dentro de otro.
 */
export function CollapsibleSection({
  icon,
  title,
  countLabel,
  status,
  badge,
  open,
  onToggle,
  actions,
  children,
}: {
  /** Nombre del ícono Material Symbols. */
  icon: string;
  title: string;
  /** «6 fotos». */
  countLabel: string;
  status?: { label: string; tone: SectionStatusTone } | null;
  /** Etiqueta fija extra al lado del título (p. ej. «Pendiente» de aprobación). */
  badge?: { label: string; hint?: string } | null;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h4 className="min-w-0 flex-1 text-sm font-bold text-ink">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex min-h-11 w-full items-center gap-2 rounded-field text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-ink"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-tint text-forest-700">
              <Icon name={icon} className="text-lg" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{title}</span>
                {badge && (
                  <span className="rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold text-orange-700" title={badge.hint}>
                    {badge.label}
                  </span>
                )}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-ink-soft">
                <span className="tabular-nums">{countLabel}</span>
                {status && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE_CLASS[status.tone]}`}>{status.label}</span>}
              </span>
            </span>
            <Icon name="expand_more" className={`shrink-0 text-2xl text-ink-soft ${open ? "rotate-180" : ""}`} />
          </button>
        </h4>
        {actions}
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </>
  );
}
