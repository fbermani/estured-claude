"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Tarjeta de condición de admisión (DR30 §4): frente con el dato breve, dorso con la explicación. Es chica y de
 * alto fijo; al tocarla gira (volteo 3D sobre el eje vertical) y muestra el texto explicativo, que se desplaza
 * dentro de la cara si es largo. Funciona con clic o teclado (el frente es un botón con `aria-expanded`), sin
 * depender de hover. La cara que no se ve queda `inert`; con `prefers-reduced-motion` el giro es instantáneo.
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
  const face =
    "absolute inset-0 flex flex-col rounded-card border-[1.5px] border-line bg-paper p-3 text-left shadow-card [backface-visibility:hidden] sm:p-3.5";
  return (
    <li className="h-[9rem] [perspective:900px] sm:h-[8.75rem]">
      <div
        className={`relative h-full w-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out ${
          open ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div
          inert={open}
          className={`${face} items-start transition-shadow hover:shadow-card-hover has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-forest`}
        >
          {/* El botón que gira la tarjeta cubre todo el frente; el contenido va encima sin capturar clics,
              salvo la nota de cotización (su propio botón «i»), para no anidar botones. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label={`Ver detalle: ${title}`}
            className="absolute inset-0 rounded-card focus-visible:outline-none"
          />
          <span className="pointer-events-none relative flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted sm:gap-1.5 sm:text-xs">
            <Icon name={icon} className="text-lg text-forest-700" />
            {title}
          </span>
          <span className="pointer-events-none relative mt-1.5 font-display text-[15px] font-extrabold tabular-nums leading-tight text-ink sm:text-lg">{value}</span>
          {note && <span className="pointer-events-none relative mt-0.5 text-xs text-ink-faint [&_button]:pointer-events-auto">{note}</span>}
          <span aria-hidden="true" className="pointer-events-none relative mt-auto inline-flex items-center gap-0.5 text-xs font-bold text-forest-700">
            Ver detalle <Icon name="autorenew" className="text-base" />
          </span>
        </div>

        <div className={`${face} [transform:rotateY(180deg)] bg-cream`} inert={!open}>
          <p className="flex shrink-0 items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-muted sm:gap-1.5 sm:text-xs">
            <Icon name={icon} className="text-lg text-forest-700" />
            {title}
          </p>
          <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto pr-1 text-[11.5px] leading-snug text-ink-soft sm:text-[13px]">{detail}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded={open}
            className="mt-1 inline-flex shrink-0 items-center gap-0.5 self-start text-xs font-bold text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Volver <Icon name="autorenew" className="text-base" />
          </button>
        </div>
      </div>
    </li>
  );
}
