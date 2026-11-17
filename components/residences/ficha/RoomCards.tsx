"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { BrandBackdrop } from "@/components/residences/ficha/BrandBackdrop";
import { modeOpensSheet, type RequestPanelMode } from "@/lib/residences/requestPanelMode";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { isTypeRequestable, typeAvailabilityMode } from "@/lib/availability/typeAvailability";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

const GENDER_ICON: Record<string, string> = { masculino: "man", femenino: "woman" };

/** Hasta esta cantidad de tipos van en grilla; con más, un carrusel con scroll-snap que deja asomar la tarjeta siguiente. */
export const ROOM_GRID_MAX = 3;

/** Rótulo sobre la foto (nombre del tipo): paper sobre el velo forest-ink al 72 %, ≥ 5:1 aun con una foto blanca detrás. */
const PHOTO_LABEL =
  "absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-[color:var(--scrim-ink-70)] px-2.5 py-1 text-[13px] font-semibold text-paper";

/**
 * «Habitaciones y precio» (propuesta A): una tarjeta por tipo, como en el mockup aprobado: foto con rótulo (la del tipo si la residencia
 * la cargó; si no, la ilustración de marca), etiqueta de disponibilidad (`StatusTag`, con su copy oficial), nombre y personas, precio en
 * USD con su referencia en ARS (`ExchangeRateNote`) y el botón «Pedir esta habitación».
 *
 * Hasta 3 tipos van en grilla. Con 4 o más pasan a un carrusel horizontal con scroll-snap: la tarjeta siguiente asoma, hay botones
 * anterior / siguiente de 44 px con `aria-label` y la tira es una lista enfocable (se desplaza con las flechas del teclado). El
 * scroll horizontal es de la tira, nunca de la página. En el carrusel la nota de la cotización va debajo de la tira (su panel se
 * recortaría dentro del contenedor con scroll); en la grilla cada monto en pesos trae su «i».
 *
 * «Pedir esta habitación» selecciona el tipo en el panel de solicitud (`ReservationSelectionProvider`: escritorio lleva el foco al panel,
 * móvil abre la hoja) para estudiantes y familiares; los invitados van a ingresar conservando la elección; el resto no ve el botón.
 * Elegir un tipo acá o con `?room=` es el mismo estado. La disponibilidad sale solo del tipo; no hay cantidades de lugares (D3/H03).
 */
export function RoomCards({
  roomTypes,
  arsPerUsd,
  waitlistTypeIds,
  mode,
  slug,
}: {
  roomTypes: FichaRoomType[];
  /** Quién mira: define qué hace el botón (abrir el panel, ir a ingresar o no mostrarse). */
  mode: RequestPanelMode;
  slug: string;
  arsPerUsd: number;
  /** Tipos completos en los que el estudiante puede sumarse a la lista de espera (vacío = no se ofrece). */
  waitlistTypeIds: string[];
}) {
  const { roomTypeId, setRoomTypeId, openSheet } = useReservationSelection();
  const opensModal = modeOpensSheet(mode);
  const loginHrefFor = (typeId: string) => `/login?next=${encodeURIComponent(`/residencias/${slug}?room=${typeId}&solicitar=1`)}`;
  const selectedId = roomTypes.find((rt) => rt.id === roomTypeId && isTypeRequestable(rt.state))?.id ?? null;
  const carousel = roomTypes.length > ROOM_GRID_MAX;

  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = trackRef.current;
    if (!carousel || !el) return;
    syncEdges();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncEdges) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [carousel, syncEdges, roomTypes.length]);

  function page(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  }

  const gridCols = roomTypes.length === 1 ? "" : roomTypes.length === 2 ? "@[28rem]:grid-cols-2" : "@[40rem]:grid-cols-3";
  const arrowClass =
    "inline-flex size-11 items-center justify-center rounded-full border-[1.5px] border-line-2 bg-paper text-ink transition-colors duration-200 ease-out-fresh hover:border-forest-700 hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-2 disabled:hover:bg-paper";

  return (
    <div className="@container min-w-0">
      {carousel && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-soft tabular-nums">{roomTypes.length} tipos de habitación: deslizá para verlos todos</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Ver los tipos de habitación anteriores" className={arrowClass}>
              <Icon name="chevron_left" className="text-2xl" />
            </button>
            <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Ver los tipos de habitación siguientes" className={arrowClass}>
              <Icon name="chevron_right" className="text-2xl" />
            </button>
          </div>
        </div>
      )}
      <ul
        ref={trackRef}
        onScroll={carousel ? syncEdges : undefined}
        {...(carousel
          ? { tabIndex: 0, role: "list", "aria-label": "Tipos de habitación (deslizable)" }
          : {})}
        className={
          carousel
            ? "-mx-1 flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain px-1 pb-3 pt-1 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-scrollbar]:hidden"
            : `grid list-none gap-3.5 p-0 ${gridCols}`
        }
      >
        {roomTypes.map((rt) => {
          const requestable = isTypeRequestable(rt.state);
          const isSelected = rt.id === selectedId;
          const availMode = typeAvailabilityMode(rt.state);
          const dim = rt.state === "full";
          const place = `Foto del tipo ${rt.name}`;
          const buttonClass = "mt-auto w-full hover:!translate-y-0";
          return (
            <li
              key={rt.id}
              aria-label={`${rt.name}, ${formatUsd(rt.priceUsd)} por mes`}
              className={`flex min-w-0 flex-col gap-3 rounded-card border-[1.5px] bg-paper p-3 transition-[box-shadow,transform] duration-200 ease-out-fresh motion-safe:hover:-translate-y-0.5 hover:shadow-card-hover ${
                isSelected ? "border-forest-700 shadow-[0_0_0_1.5px_var(--color-forest-700)]" : "border-line shadow-card"
              } ${carousel ? "w-[78%] shrink-0 snap-start @[30rem]:w-[44%] @[40rem]:w-[31%]" : ""}`}
            >
              <figure className={`relative m-0 aspect-[16/10] overflow-hidden rounded-field bg-forest-700 ${dim ? "opacity-60" : ""}`}>
                {rt.photoUrl ? (
                  <Image src={rt.photoUrl} alt={place} fill sizes="(max-width: 640px) 78vw, 260px" className="object-cover" />
                ) : (
                  <BrandBackdrop />
                )}
                <figcaption className={PHOTO_LABEL}>{rt.name}</figcaption>
              </figure>

              <div className="min-w-0">
                <StatusTag mode={availMode} roomTypeName={rt.state === "full" ? rt.name : null} withTip />
                <h3 className={`mt-2 font-display text-[22px] font-bold leading-tight ${requestable ? "text-ink" : "text-ink-soft"}`}>{rt.name}</h3>
                {rt.subtitle && <p className="mt-0.5 text-[14px] leading-snug text-ink-soft">{rt.subtitle}</p>}
              </div>

              <div className={`min-w-0 ${dim ? "opacity-60" : ""}`}>
                {rt.listPriceUsd != null && (
                  <p className="text-sm font-semibold tabular-nums text-ink-faint line-through">
                    <span className="sr-only">Antes </span>
                    {formatUsd(rt.listPriceUsd)}
                  </p>
                )}
                <p className="font-display text-[28px] font-bold leading-none tracking-tight tabular-nums text-ink">
                  <span className="whitespace-nowrap">{formatUsd(rt.priceUsd)}</span>{" "}
                  <small className="font-sans text-[15px] font-semibold tracking-normal text-ink-faint">/mes</small>
                </p>
                <p className="mt-1 flex items-center text-[14px] tabular-nums text-ink-soft">
                  ≈ {formatArs(rt.arsRounded)}
                  {!carousel && <ExchangeRateNote compact />}
                </p>
                {rt.promotion && (
                  <p className="mt-1 text-[13px] font-bold text-forest-700">
                    {rt.promotion.label}: −{rt.promotion.percent}%
                    {rt.promotion.endsOn ? ` hasta el ${formatDateOnly(rt.promotion.endsOn)}` : ""}
                  </p>
                )}
              </div>

              {rt.genderOffers && rt.genderOffers.length > 1 && (
                <ul aria-label={`${rt.name}, por género`} className="min-w-0 space-y-2 border-t-[1.5px] border-line pt-3">
                  {rt.genderOffers.map((o) => (
                    <li key={o.gender} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft">
                        <Icon name={GENDER_ICON[o.gender] ?? "wc"} className="text-base text-forest-700" />
                        {o.label}
                      </span>
                      <StatusTag mode={typeAvailabilityMode(o.state)} roomTypeName={o.state === "full" ? o.label : null} />
                      {o.note && <p className="basis-full text-xs text-ink-faint">{o.note}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {requestable && opensModal ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRoomTypeId(rt.id);
                    openSheet("request");
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Pedir esta habitación: ${rt.name}`}
                  className={buttonClass}
                >
                  {isSelected && <Icon name="check" className="text-lg" />}
                  Pedir esta habitación
                </Button>
              ) : requestable && mode === "guest" ? (
                <Button href={loginHrefFor(rt.id)} variant="outline" aria-label={`Pedir esta habitación: ${rt.name}`} className={buttonClass}>
                  Pedir esta habitación
                </Button>
              ) : !requestable && mode === "student" && waitlistTypeIds.includes(rt.id) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRoomTypeId(rt.id);
                    openSheet("waitlist");
                  }}
                  aria-label={`Lista de espera: ${rt.name}`}
                  className={buttonClass}
                >
                  Lista de espera
                </Button>
              ) : !requestable && mode === "guest" && rt.state === "full" ? (
                <Button href={loginHrefFor(rt.id)} variant="outline" aria-label={`Lista de espera: ${rt.name}`} className={buttonClass}>
                  Lista de espera
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm leading-snug text-ink-faint">
        Los pesos son referenciales, según la cotización de referencia de hoy (ARS {Math.round(arsPerUsd).toLocaleString("es-AR")}).
        <ExchangeRateNote showNote={carousel} />
      </p>
    </div>
  );
}
