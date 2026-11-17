import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { faqChipLabel } from "@/lib/residences/fichaHero";
import { OpenFaqButton } from "@/components/residences/ficha/FaqModal";
import type { EssentialCell } from "@/lib/residences/fichaEssentials";

const CHIP =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-forest-700 bg-paper px-[18px] text-[15px] font-bold text-forest-700 transition-colors duration-200 ease-out-fresh hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest min-[768px]:justify-self-end";

/**
 * Franja «Lo esencial» bajo el hero (propuesta A): hasta cinco celdas de la misma altura (Desde, Habitaciones, Estadía mínima, Cerca de y
 * Edades),
 * cada una con ícono, etiqueta, valor que no se parte y una bajada de una línea, separadas por filetes; y el botón de contorno que lleva
 * a las preguntas frecuentes: abre la lista completa en un modal (`faqCount` = TODAS las de la residencia, no solo las destacadas); sin
 * preguntas el botón no se dibuja. Móvil: grilla 2×2 con borde y filetes internos (una quinta celda ocupa la
 * fila entera) y el botón a todo el ancho debajo. Escritorio
 * (≥ 768 px): una fila de celdas; el botón queda a la derecha desde 1100 px y en su propia fila antes.
 * Las celdas vienen de `buildEssentialCells` (datos ya calculados por la página; una celda sin dato no se dibuja). Todo monto en USD
 * trae su referencia en ARS con `ExchangeRateNote compact`.
 */
export function EssentialsStrip({ cells, faqCount }: { cells: EssentialCell[]; faqCount: number }) {
  if (cells.length === 0) return null;
  const odd = cells.length % 2 === 1;
  return (
    <section aria-label="Lo esencial" className="border-b-[1.5px] border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 sm:px-6 min-[1100px]:grid-cols-[minmax(0,1fr)_auto] min-[1100px]:items-center min-[1100px]:gap-6 min-[1100px]:py-[18px]">
        <ul className="grid grid-cols-2 rounded-field border-[1.5px] border-line min-[768px]:grid-cols-[repeat(var(--cells),minmax(0,1fr))] min-[768px]:rounded-none min-[768px]:border-0" style={{ "--cells": cells.length } as CSSProperties}>
          {cells.map((cell, i) => (
            <li
              key={cell.key}
              aria-label={cell.ariaLabel}
              className={`grid min-w-0 content-start gap-y-0.5 px-3 py-3 ${cells.length > 4 ? "min-[768px]:px-3 min-[1100px]:px-5" : "min-[768px]:px-5"} min-[768px]:py-1 min-[768px]:first:pl-0 ${
                i % 2 === 1 ? "border-l-[1.5px] border-line" : ""
              } ${i >= 2 ? "border-t-[1.5px] border-line" : ""} ${odd && i === cells.length - 1 ? "col-span-2 min-[768px]:col-span-1" : ""} min-[768px]:border-t-0 min-[768px]:border-l-[1.5px] min-[768px]:first:border-l-0`}
            >
              <span className="flex items-center gap-1.5 text-[13px] leading-5 text-ink-faint">
                <Icon name={cell.icon} className="text-lg text-forest-700" />
                {cell.label}
              </span>
              <span className="whitespace-nowrap font-display text-[clamp(1rem,5vw,1.125rem)] font-bold leading-tight tabular-nums text-ink min-[768px]:text-lg">
                {cell.value}
                {cell.unit && <span className="ml-0.5 font-sans text-[13px] font-normal text-ink-faint">{cell.unit}</span>}
              </span>
              {cell.sub && (
                <span className="flex min-w-0 items-center text-[13px] leading-5 tabular-nums text-ink-soft" title={cell.title}>
                  <span className="min-w-0 truncate">{cell.sub}</span>
                  {cell.subIsArs && <ExchangeRateNote compact />}
                </span>
              )}
            </li>
          ))}
        </ul>
        {faqCount > 0 && (
          <OpenFaqButton className={CHIP}>
            {faqChipLabel(faqCount)}
            <Icon name="arrow_forward" className="text-lg" />
          </OpenFaqButton>
        )}
      </div>
    </section>
  );
}
