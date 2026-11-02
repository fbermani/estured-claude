"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Tarjeta de condición de admisión (DR30 §4): frente con dato breve, dorso con la explicación. Ambas caras
 * ocupan la misma celda de grilla (la tarjeta mide lo que mide la cara más alta, igual en todas las de la
 * fila). Se voltea con un botón (`aria-expanded`), sin depender de hover; el cambio es un fundido que se
 * apaga con `prefers-reduced-motion`.
 */
export function ConditionCard({
  icon,
  title,
  value,
  note,
  detail,
}: {
  icon: string;
  title: string;
  value: string;
  /** Texto chico junto al valor («única vez», «≈ ARS …»). */
  note?: ReactNode;
  /** Explicación del dorso. */
  detail: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const face = "col-start-1 row-start-1 motion-safe:transition-opacity motion-safe:duration-200";
  return (
    <li className="grid rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <div className={`${face} ${open ? "invisible opacity-0" : "opacity-100"}`} aria-hidden={open || undefined}>
        <div className="relative flex h-full flex-col items-start p-3.5 text-left sm:p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label={`Ver detalle: ${title}`}
            tabIndex={open ? -1 : 0}
            className="absolute inset-0 rounded-card"
          />
          <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted sm:gap-1.5 sm:text-xs">
            <Icon name={icon} className="text-lg text-forest-700" />
            {title}
          </span>
          <span className="mt-2 font-display text-base font-extrabold sm:text-xl leading-tight text-ink">{value}</span>
          {note && <span className="relative z-10 mt-0.5 text-xs text-ink-faint">{note}</span>}
          <span aria-hidden="true" className="mt-auto inline-flex items-center gap-0.5 pt-3 text-xs font-bold text-forest-700">
            Ver detalle <Icon name="expand_more" className="text-base" />
          </span>
        </div>
      </div>
      <div
        className={`${face} flex flex-col p-3.5 sm:p-4 ${open ? "opacity-100" : "invisible opacity-0"}`}
        aria-hidden={!open || undefined}
      >
        <p className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted sm:gap-1.5 sm:text-xs">
          <Icon name={icon} className="text-lg text-forest-700" />
          {title}
        </p>
        <div className="mt-2 text-xs leading-relaxed text-ink-soft sm:text-sm">{detail}</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded={open}
          tabIndex={open ? 0 : -1}
          className="mt-auto inline-flex items-center gap-0.5 self-start pt-3 text-xs font-bold text-forest-700"
        >
          Volver <Icon name="expand_less" className="text-base" />
        </button>
      </div>
    </li>
  );
}
