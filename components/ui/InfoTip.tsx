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
    function onClickOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex align-middle"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={label}
        className="relative -ml-[11px] -mr-[15px] inline-flex size-11 items-center justify-center align-middle -my-4 text-muted hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-forest rounded-full"
      >
        <span aria-hidden className="inline-flex size-4 items-center justify-center rounded-full border border-current text-xs font-bold leading-none">
          i
        </span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-[calc(50%+2px)] z-20 mb-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-field border-[1.5px] border-line bg-paper p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-float"
        >
          {children}
        </span>
      )}
    </span>
  );
}
