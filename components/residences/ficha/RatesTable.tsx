"use client";

import { Button } from "@/components/ui/Button";
import { modeOpensSheet, type RequestPanelMode } from "@/lib/residences/requestPanelMode";
import { Icon } from "@/components/ui/Icon";
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

/** Si el nombre ya dice cuántas personas son («Individual», «Doble»…), no se repite la capacidad. */
const NAME_IMPLIES_CAPACITY = /individual|simple|doble|triple|cu[aá]druple|cuadruple|compartid/i;

/** Columnas fijas en pantallas ≥ @[42rem]: tipo | precio | disponibilidad | acción. Así precio, estado y botón quedan alineados en todas las filas. */
const ROW_GRID = "@[42rem]:grid @[42rem]:grid-cols-[minmax(0,1fr)_9rem_12.5rem_7.5rem] @[42rem]:items-center @[42rem]:gap-x-4";
const GENDER_ICON: Record<string, string> = { masculino: "man", femenino: "woman" };

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
      <Icon name={icon} className="text-base text-forest-700" />
      {children}
    </span>
  );
}

/**
 * "Tarifas" — una línea por tipo, visible para TODOS (H10 / D17, DR30 §4). «Elegir» selecciona el tipo en el panel de solicitud
 * (escritorio: lleva el foco ahí; móvil: abre la hoja) para estudiantes y familiares; invitados van a ingresar conservando la elección; el resto no ve el botón.
 * Elegir un tipo acá o con `?room=` es el mismo estado (`ReservationSelectionProvider`). La disponibilidad sale solo
 * del tipo (`StatusTag` con su copy oficial); no hay cantidades de lugares (D3/H03).
 */
export function RatesTable({
  roomTypes,
  arsPerUsd,
  waitlistTypeIds,
  mode,
  slug,
}: {
  roomTypes: FichaRoomType[];
  /** Quién mira: define qué hace «Elegir» (abrir el modal, ir a ingresar o no mostrarse). */
  mode: RequestPanelMode;
  slug: string;
  arsPerUsd: number;
  /** Tipos completos en los que el estudiante puede sumarse a la lista de espera (vacío = no se ofrece). */
  waitlistTypeIds: string[];
}) {
  const { roomTypeId, setRoomTypeId, openSheet } = useReservationSelection();
  const opensModal = modeOpensSheet(mode);
  const loginHrefFor = (typeId: string) =>
    `/login?next=${encodeURIComponent(`/residencias/${slug}?room=${typeId}&solicitar=1`)}`;
  const selectedId = roomTypes.find((rt) => rt.id === roomTypeId && isTypeRequestable(rt.state))?.id ?? null;

  return (
    <div className="@container overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <ul className="divide-y divide-line">
        {roomTypes.map((rt) => {
          const requestable = isTypeRequestable(rt.state);
          const isSelected = rt.id === selectedId;
          const availMode = typeAvailabilityMode(rt.state);
          const stateText = availabilityLabel(availMode, rt.state === "full" ? rt.name : null);
          const impliesCapacity = NAME_IMPLIES_CAPACITY.test(rt.name);
          const nameIcon = rt.capacity === 1 ? "person" : "group";
          return (
            <li
              key={rt.id}
              aria-label={`${rt.name}, ${formatUsd(rt.priceUsd)} por mes, ${stateText}`}
              className={`relative px-4 py-3 transition-colors duration-200 ease-fresh ${
                isSelected ? "bg-forest-tint/55" : requestable ? "" : "bg-cream-2/40"
              }`}
            >
              {isSelected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-forest" />}
              <div className={`grid gap-y-2 ${ROW_GRID}`}>
                <div className="min-w-0">
                  <p className={`flex items-center gap-1.5 font-bold ${requestable ? "text-ink" : "text-ink-soft"}`}>
                    <Icon name={nameIcon} className="text-lg text-forest-700" />
                    <span className="min-w-0 truncate">{rt.name}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {rt.capacity != null && !impliesCapacity && (
                      <Chip icon="group">
                        {rt.capacity} {rt.capacity === 1 ? "persona" : "personas"}
                      </Chip>
                    )}
                    {rt.genderLabel && <Chip icon="wc">{rt.genderLabel}</Chip>}
                    {rt.bathroom && (
                      <Chip icon={rt.bathroom === "privado" ? "shower" : "bathroom"}>
                        Baño {rt.bathroom}
                      </Chip>
                    )}
                  </div>
                </div>

                <div className="min-w-0 @[42rem]:text-right">
                  <p className={`font-display text-lg font-bold leading-tight ${requestable ? "text-ink" : "text-ink-soft"}`}>
                    {rt.listPriceUsd != null && (
                      <span className="mr-1.5 text-sm font-semibold text-ink-faint line-through @[42rem]:mr-0 @[42rem]:block @[42rem]:text-xs">
                        <span className="sr-only">Antes </span>
                        {formatUsd(rt.listPriceUsd)}
                      </span>
                    )}
                    <span className="whitespace-nowrap">
                      {formatUsd(rt.priceUsd)}
                      <span className="text-xs font-semibold text-ink-faint"> /mes</span>
                    </span>
                  </p>
                  <p className="text-xs text-ink-faint">≈ {formatArs(rt.arsRounded)}</p>
                  {rt.promotion && (
                    <p className="text-xs font-bold text-forest-700">
                      {rt.promotion.label}: −{rt.promotion.percent}%
                      {rt.promotion.endsOn ? ` hasta el ${formatDateOnly(rt.promotion.endsOn)}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 @[42rem]:contents">
                  <div className="@[42rem]:justify-self-start">
                    <StatusTag mode={availMode} roomTypeName={rt.state === "full" ? rt.name : null} withTip />
                  </div>
                  <div className="@[42rem]:w-full">
                  {requestable && opensModal ? (
                    <Button
                      type="button"
                      variant={isSelected ? "primary" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRoomTypeId(rt.id);
                        openSheet("request");
                      }}
                      aria-label={`Elegir: ${rt.name}`}
                      className="@[42rem]:!h-9 @[42rem]:!w-full @[42rem]:!px-4 @[42rem]:text-xs hover:!translate-y-0"
                    >
                      Elegir
                    </Button>
                  ) : requestable && mode === "guest" ? (
                    <Button
                      href={loginHrefFor(rt.id)}
                      variant="outline"
                      size="sm"
                      className="@[42rem]:!h-9 @[42rem]:!w-full @[42rem]:!px-4 @[42rem]:text-xs hover:!translate-y-0"
                    >
                      Elegir
                    </Button>
                  ) : !requestable && mode === "student" && waitlistTypeIds.includes(rt.id) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRoomTypeId(rt.id);
                        openSheet("waitlist");
                      }}
                      className="!px-4 @[42rem]:!h-9 @[42rem]:!w-full @[42rem]:!px-3 @[42rem]:text-xs"
                    >
                      Lista de espera
                    </Button>
                  ) : !requestable && mode === "guest" && rt.state === "full" ? (
                    <Button
                      href={loginHrefFor(rt.id)}
                      variant="outline"
                      size="sm"
                      className="!px-4 @[42rem]:!h-9 @[42rem]:!w-full @[42rem]:!px-3 @[42rem]:text-xs"
                    >
                      Lista de espera
                    </Button>
                  ) : null}
                  </div>
                </div>
              </div>

              {rt.genderOffers && rt.genderOffers.length > 1 && (
                <ul aria-label={`${rt.name}, por género`} className="mt-3 space-y-2 border-t border-line/70 pt-3">
                  {rt.genderOffers.map((o) => (
                    <li key={o.gender} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${ROW_GRID}`}>
                      <span className="flex min-w-0 items-center gap-1.5 pl-1 text-sm font-semibold text-ink-soft @[42rem]:col-span-2">
                        <Icon name={GENDER_ICON[o.gender] ?? "wc"} className="text-base text-forest-700" />
                        {o.label}
                      </span>
                      <span className="@[42rem]:justify-self-start">
                        <StatusTag mode={typeAvailabilityMode(o.state)} roomTypeName={o.state === "full" ? o.label : null} />
                      </span>
                      {o.note && <p className="basis-full text-xs text-ink-faint @[42rem]:col-span-4">{o.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line bg-cream-2/60 px-4 py-2.5 text-xs text-ink-faint">
        Los pesos son referenciales, según la cotización de referencia de hoy (ARS {Math.round(arsPerUsd).toLocaleString("es-AR")}).
        <ExchangeRateNote />
      </p>
    </div>
  );
}
