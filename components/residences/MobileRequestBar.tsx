"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Barra fija inferior de la ficha para pantallas donde el panel de
 * solicitud queda debajo del contenido (< lg): "Desde USD X · Solicitar"
 * lleva a `#solicitud`. Se oculta sola cuando el panel ya está a la vista
 * (para no duplicar el CTA) o cuando aparece el footer (H31, auditoría 2026-10-20).
 */
export function MobileRequestBar({
  priceLabel,
  ctaLabel = "Solicitar",
}: {
  /** Precio ya formateado ("USD 320"), o null si no hay tipos con precio. */
  priceLabel: string | null;
  ctaLabel?: string;
}) {
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
        {priceLabel ? (
          <p className="leading-tight">
            <span className="block text-xs font-semibold text-ink-faint">Desde</span>
            <span className="text-lg font-extrabold text-ink">{priceLabel}</span>
            <span className="text-xs font-semibold text-ink-faint"> /mes</span>
          </p>
        ) : (
          <span />
        )}
        <Button href="#solicitud" size="md">
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
