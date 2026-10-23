"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatUsd } from "@/lib/mock/exchange";
import { isTypeRequestable } from "@/lib/availability/typeAvailability";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * Barra fija inferior de la ficha para pantallas donde el panel de
 * solicitud queda debajo del contenido (< lg): "Desde USD X · Solicitar"
 * o "{Tipo} USD X · Solicitar". Con un tipo elegido y un rol que puede
 * solicitar (o proponer), el CTA abre la hoja de solicitud; si no, lleva a
 * `#tarifas` para elegir un tipo (o iniciar sesión). Se oculta sola cuando
 * el panel ya está a la vista (para no duplicar el CTA) o cuando aparece el
 * footer (H31, auditoría 2026-10-20).
 */
export function MobileRequestBar({
  roomTypes,
  fromPriceUsd,
  opensSheet,
  ctaLabel = "Solicitar",
}: {
  roomTypes: FichaRoomType[];
  /** "Desde" ya calculado en el servidor (mínimo de los tipos que admiten solicitud); null si no hay precios. */
  fromPriceUsd: number | null;
  /** El rol actual puede abrir la hoja (estudiante o familiar). Invitados y demás van a `#tarifas`. */
  opensSheet: boolean;
  ctaLabel?: string;
}) {
  const { roomTypeId, openSheet } = useReservationSelection();
  const selected = roomTypes.find((rt) => rt.id === roomTypeId && isTypeRequestable(rt.state)) ?? null;
  const priceUsd = selected?.priceUsd ?? fromPriceUsd;
  // Se oculta cuando el panel de solicitud o el footer ya están a la vista
  // (el footer tiene enlaces legales que la barra taparía).
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const panel = document.getElementById("solicitud");
    const footer = document.querySelector("footer");
    const visible = new Set<Element>();
    const observe = (target: Element | null, options: IntersectionObserverInit) => {
      if (!target) return null;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setHidden(visible.size > 0);
      }, options);
      observer.observe(target);
      return observer;
    };
    // Panel: a la vista (>= 15%). Footer: apenas asoma por encima de la barra (~80px de alto).
    const panelObserver = observe(panel, { threshold: 0.15 });
    const footerObserver = observe(footer, { threshold: 0, rootMargin: "0px 0px -80px 0px" });
    return () => {
      panelObserver?.disconnect();
      footerObserver?.disconnect();
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-float backdrop-blur transition-transform duration-300 lg:hidden ${
        hidden ? "invisible translate-y-full" : "visible translate-y-0"
      }`}
      aria-hidden={hidden}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        {priceUsd != null ? (
          <p className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-semibold text-ink-faint">{selected ? selected.name : "Desde"}</span>
            <span className="text-lg font-extrabold text-ink">{formatUsd(priceUsd)}</span>
            <span className="text-xs font-semibold text-ink-faint"> /mes</span>
          </p>
        ) : (
          <span />
        )}
        {opensSheet && selected ? (
          <Button type="button" size="md" onClick={() => openSheet("request")} className="shrink-0">
            {ctaLabel}
          </Button>
        ) : (
          <Button href="#tarifas" size="md" className="shrink-0">
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
