"use client";

import { StatusTag } from "@/components/ui/StatusTag";
import { formatUsd } from "@/lib/mock/exchange";
import { typeAvailabilityMode } from "@/lib/availability/typeAvailability";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * Tipos de habitación como tarjetas de radio (panel de solicitud de la ficha): nombre, precio mensual (con la promo ya
 * aplicada, si hay) y el estado oficial de disponibilidad (`StatusTag`, sin cambiar su copy). Los radios llevan el
 * `name` nativo para que el valor viaje en el `<form>`. Elegir un tipo es el mismo estado que «Elegir» en la tabla.
 */
export function RoomTypeCards({
  types,
  value,
  onChange,
  name,
  error,
  errorId,
}: {
  types: FichaRoomType[];
  value: string;
  onChange: (id: string) => void;
  /** `name` del radio; omitido = no participa de ningún formulario (panel del visitante sin sesión). */
  name?: string;
  error?: string | null;
  errorId?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold text-ink-soft">Tipo de habitación</legend>
      <div className="grid gap-2">
        {types.map((rt) => {
          const selected = rt.id === value;
          const details = [rt.genderLabel, rt.bathroom ? `Baño ${rt.bathroom}` : null].filter(Boolean).join(", ");
          return (
            <label
              key={rt.id}
              className={`relative flex cursor-pointer flex-col gap-1.5 rounded-field border-[1.5px] px-3.5 py-2.5 transition-colors duration-200 ease-fresh has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest ${
                selected ? "border-forest bg-forest-tint/60" : "border-line-2 bg-paper hover:border-forest"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={rt.id}
                checked={selected}
                onChange={() => onChange(rt.id)}
                aria-describedby={error ? errorId : undefined}
                className="sr-only"
              />
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`size-4 shrink-0 rounded-full border-2 ${
                    selected ? "border-forest bg-forest shadow-[inset_0_0_0_2px_var(--color-paper)]" : "border-line-2"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate font-bold text-ink">{rt.name}</span>
                <span className="shrink-0 text-right tabular-nums">
                  {rt.listPriceUsd != null && (
                    <span className="mr-1.5 text-xs font-semibold text-ink-faint line-through">
                      <span className="sr-only">Antes </span>
                      {formatUsd(rt.listPriceUsd)}
                    </span>
                  )}
                  <b className="font-display text-base font-bold text-ink">{formatUsd(rt.priceUsd)}</b>
                  <span className="text-xs text-ink-faint">/mes</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[26px]">
                <StatusTag mode={typeAvailabilityMode(rt.state)} roomTypeName={rt.state === "full" ? rt.name : null} />
                {details && <span className="text-xs text-ink-faint">{details}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-danger-fg">
          {error}
        </p>
      )}
    </fieldset>
  );
}
