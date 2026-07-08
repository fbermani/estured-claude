"use client";

import { useEffect, useRef, useState } from "react";

/** Docs/08 §2.8 / docs/00 §13.3: texto exacto, obligatorio en toda conversión USD → ARS. */
const EXCHANGE_RATE_DISCLAIMER =
  "El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento.";

/** Docs/08 §9.9: modal breve reutilizable, siempre junto a un monto convertido de USD a ARS. */
export function ExchangeRateNote() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Por qué este valor en pesos es referencial"
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-faint text-[9px] font-bold leading-none text-ink-faint hover:border-petrol-500 hover:text-petrol-600"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-field border border-sand-200 bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-float"
        >
          {EXCHANGE_RATE_DISCLAIMER}
        </span>
      )}
    </span>
  );
}
