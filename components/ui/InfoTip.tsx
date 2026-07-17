"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tooltip informativo genérico (hover + click/focus) para explicar
 * cargos y conceptos junto a montos — pedido del dueño 2026-07-15:
 * "es importante que sea explícito con mouse hover y llamadas". Mismo
 * patrón visual que `ExchangeRateNote` (que mantiene su copy oficial
 * obligatorio de docs/08 §2.8), pero con contenido libre por prop.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
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
    <span
      ref={containerRef}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={label}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted text-[9px] font-bold leading-none text-muted hover:border-forest hover:text-forest"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-field border-[1.5px] border-line bg-paper p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-float"
        >
          {children}
        </span>
      )}
    </span>
  );
}
