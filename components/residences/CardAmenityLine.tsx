"use client";

import { useEffect, useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

export type CardAmenity = { name: string; icon: string };

/**
 * Línea de servicios o áreas comunes de la tarjeta de /search (auditoría 2026-11-03): rótulo + hasta 5 íconos + «+N».
 * En escritorio (mouse), pasar el mouse o enfocar con teclado muestra la lista completa con nombres; en móvil, tocar abre
 * una hoja inferior con la misma lista. Es un solo botón, así que queda FUERA del enlace de la tarjeta (z-index sobre el
 * overlay del título). Esc cierra la hoja y el foco vuelve al botón (lo resuelve `Dialog`).
 */
export function CardAmenityLine({
  label,
  residenceName,
  items,
  maxIcons = 5,
}: {
  label: string;
  residenceName: string;
  items: CardAmenity[];
  maxIcons?: number;
}) {
  const [sheet, setSheet] = useState(false);
  const titleId = useId();
  const popId = useId();
  // Si la ventana pasa a una pantalla con mouse con la hoja abierta, se cierra (ahí la lista sale al pasar el mouse).
  useEffect(() => {
    if (!sheet) return;
    const mq = window.matchMedia("(hover: hover)");
    const onChange = () => mq.matches && setSheet(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [sheet]);

  if (items.length === 0) return null;
  const shown = items.slice(0, maxIcons);
  const extra = items.length - shown.length;

  return (
    <div className="group/amen relative z-[2]">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-describedby={popId}
        aria-label={`${label}: ${items.map((i) => i.name).join(", ")}`}
        onClick={() => {
          if (!window.matchMedia("(hover: hover)").matches) setSheet(true);
        }}
        className="-mx-1.5 grid w-[calc(100%+0.75rem)] cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 min-[400px]:grid-cols-[5.25rem_minmax(0,1fr)] rounded-field px-1.5 py-1 text-left hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest"
      >
        <span aria-hidden="true" className="text-xs font-bold leading-tight text-ink-faint">
          {label}
        </span>
        <span aria-hidden="true" className="flex min-w-0 flex-nowrap items-center gap-1">
          {shown.map((i) => (
            <span key={i.name} className="inline-grid aspect-square min-w-0 max-w-7 flex-1 place-items-center rounded-field bg-cream-2 text-forest-700">
              <Icon name={i.icon} className="text-[clamp(14px,4.4vw,17px)]" />
            </span>
          ))}
          {extra > 0 && (
            <span className="inline-flex h-7 shrink-0 items-center rounded-field bg-forest-tint px-1.5 text-[12px] font-bold text-forest-700">+{extra}</span>
          )}
        </span>
      </button>
      <div
        id={popId}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+4px)] left-0 z-10 hidden w-max max-w-[min(15rem,100%)] rounded-field border border-line-2 bg-paper px-2.5 py-2 text-left shadow-float [@media(hover:hover)]:group-focus-within/amen:block [@media(hover:hover)]:group-hover/amen:block"
      >
        <ul className="grid gap-y-0.5 text-[12px] leading-tight text-ink-soft">
          {items.map((i) => (
            <li key={i.name} className="flex min-w-0 items-center gap-1.5">
              <Icon name={i.icon} className="text-[15px] text-forest-700" />
              <span className="min-w-0">{i.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={sheet} onClose={() => setSheet(false)} labelledBy={titleId} maxWidthClass="sm:max-w-xs">
        <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
          <div>
            <h2 id={titleId} className="text-lg">{label}</h2>
            <p className="text-[13px] text-ink-faint">{residenceName}</p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={() => setSheet(false)}
            aria-label="Cerrar"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-cream-2 text-ink-soft focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <ul className="grid gap-y-1.5 overflow-y-auto px-4 pb-4 pt-2 text-[13.5px] text-ink-soft">
          {items.map((i) => (
            <li key={i.name} className="flex items-center gap-2">
              <Icon name={i.icon} className="text-lg text-forest-700" />
              <span className="min-w-0">{i.name}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
