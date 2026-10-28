"use client";

import { Button } from "@/components/ui/Button";
import { StatusTag, availabilityLabel } from "@/components/ui/StatusTag";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import {
  isTypeRequestable,
  typeAvailabilityMode,
} from "@/lib/availability/typeAvailability";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * "Tarifas y condiciones" — tarifas por tipo, visibles para TODOS (H10 / D17). Es un `radiogroup`:
 * elegir un tipo acá, en la card lateral o con `?room=` es el mismo estado (`ReservationSelectionProvider`).
 * La disponibilidad sale solo del tipo (`StatusTag` con su copy oficial); no hay cantidades de lugares (D3/H03).
 */
export function RatesTable({
  roomTypes,
  arsPerUsd,
  waitlistTypeIds,
}: {
  roomTypes: FichaRoomType[];
  arsPerUsd: number;
  /** Tipos completos en los que el estudiante puede sumarse a la lista de espera (vacío = no se ofrece). */
  waitlistTypeIds: string[];
}) {
  const { roomTypeId, setRoomTypeId, openSheet } = useReservationSelection();
  const selectedId = roomTypes.find((rt) => rt.id === roomTypeId && isTypeRequestable(rt.state))?.id ?? null;

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Elegí un tipo de habitación</legend>
      <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem] gap-x-3 border-b border-line bg-cream-2 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-widest text-muted sm:grid"
        >
          <span />
          <span>Tipo de habitación</span>
          <span>Por mes</span>
          <span>Disponibilidad</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {roomTypes.map((rt) => {
            const requestable = isTypeRequestable(rt.state);
            const isSelected = rt.id === selectedId;
            const mode = typeAvailabilityMode(rt.state);
            const stateText = availabilityLabel(mode, rt.state === "full" ? rt.name : null);
            const inputId = `tarifa-${rt.id}`;
            return (
              <li
                key={rt.id}
                className={`relative transition-colors duration-200 ease-fresh ${
                  isSelected ? "bg-forest-tint/55" : requestable ? "hover:bg-cream-2/60" : "bg-cream-2/40"
                }`}
              >
                {isSelected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-forest" />}
                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 px-4 py-4 sm:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem] sm:items-center">
                  <input
                    id={inputId}
                    type="radio"
                    name="tipo-tarifas"
                    value={rt.id}
                    checked={isSelected}
                    disabled={!requestable}
                    onChange={() => setRoomTypeId(rt.id)}
                    aria-label={`${rt.name}, ${formatUsd(rt.priceUsd)} por mes, ${stateText}`}
                    className="mt-1 h-5 w-5 cursor-pointer accent-[var(--color-forest)] disabled:cursor-not-allowed sm:mt-0"
                  />
                  <label
                    htmlFor={inputId}
                    className={`min-w-0 ${requestable ? "cursor-pointer" : "cursor-default"} sm:col-start-2`}
                  >
                    <span className={`block font-bold ${requestable ? "text-ink" : "text-ink-soft"}`}>{rt.name}</span>
                    {rt.subtitle && <span className="mt-0.5 block text-sm text-ink-soft">{rt.subtitle}</span>}
                  </label>

                  <div className="col-start-2 mt-2 sm:col-start-3 sm:mt-0">
                    <p className={`font-display text-lg font-extrabold leading-tight ${requestable ? "text-ink" : "text-ink-soft"}`}>
                      {rt.listPriceUsd != null && (
                        <span className="mr-1.5 text-sm font-semibold text-ink-faint line-through">
                          <span className="sr-only">Antes </span>
                          {formatUsd(rt.listPriceUsd)}
                        </span>
                      )}
                      {formatUsd(rt.priceUsd)}
                      <span className="text-xs font-semibold text-ink-faint"> /mes</span>
                    </p>
                    {rt.promotion && (
                      <p className="text-xs font-bold text-forest-700">
                        {rt.promotion.label} · −{rt.promotion.percent}%
                        {rt.promotion.endsOn ? ` hasta el ${formatDateOnly(rt.promotion.endsOn)}` : ""}
                      </p>
                    )}
                    <p className="text-xs text-ink-faint">≈ {formatArs(rt.arsRounded)}</p>
                  </div>

                  <div className="col-start-2 mt-2.5 sm:col-start-4 sm:mt-0">
                    <StatusTag mode={mode} roomTypeName={rt.state === "full" ? rt.name : null} withTip />
                  </div>

                  <div className="col-start-2 mt-3 sm:col-start-5 sm:mt-0 sm:justify-self-end">
                    {requestable ? (
                      <Button
                        type="button"
                        variant={isSelected ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setRoomTypeId(rt.id)}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? "Elegido" : "Elegir"}: ${rt.name}`}
                        className="!h-9 !px-4 text-xs hover:!translate-y-0"
                      >
                        {isSelected ? "Elegido" : "Elegir"}
                      </Button>
                    ) : waitlistTypeIds.includes(rt.id) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRoomTypeId(rt.id);
                          openSheet("waitlist");
                        }}
                        className="!h-9 !px-3 text-xs"
                      >
                        Lista de espera
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line bg-cream-2/60 px-4 py-2.5 text-xs text-ink-faint">
          Los pesos son referenciales, según la cotización de referencia de hoy (ARS {Math.round(arsPerUsd).toLocaleString("es-AR")}).
          <ExchangeRateNote />
        </p>
      </div>
    </fieldset>
  );
}
