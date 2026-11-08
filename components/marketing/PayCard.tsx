"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Tarjeta de «Qué pagás y a quién». Se expande con hover del mouse (desktop) y con
 * click/tap o teclado (mobile y accesibilidad). El detalle es el mismo en ambos casos.
 */
export function PayCard({
  icon,
  label,
  amount,
  text,
  toneClass,
}: {
  icon: string;
  label: string;
  amount: string;
  text: string;
  toneClass: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className={`group rounded-card border transition-shadow hover:shadow-card ${open ? "shadow-card" : ""} ${toneClass}`}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          // Con mouse el hover ya abrió la tarjeta: el click no debe cerrarla.
          // Click de teclado (detail 0) y tap/touch alternan.
          const isMouseClick = e.detail > 0 && (e.nativeEvent as PointerEvent).pointerType === "mouse";
          if (!isMouseClick) setOpen((v) => !v);
        }}
        className="flex w-full cursor-pointer flex-col gap-1 rounded-card p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
      >
        <span className="flex items-start justify-between">
          <Icon name={icon} className="text-3xl text-forest-700" />
          <Icon
            name="expand_more"
            className={`text-2xl text-forest-700 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </span>
        <span className="mt-2 text-xs font-bold text-ink-faint">{label}</span>
        <span className="font-display text-xl font-bold text-ink">{amount}</span>
      </button>
      <div id={panelId} hidden={!open}>
        <p className="benefit-fade-in border-t border-black/5 px-5 pb-5 pt-3 text-sm leading-relaxed text-ink-soft">{text}</p>
      </div>
    </div>
  );
}
