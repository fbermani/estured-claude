"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Docs/08 §2.8 / docs/00 §13.3: texto exacto, obligatorio en toda conversión USD → ARS. */
const EXCHANGE_RATE_DISCLAIMER =
  "El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento.";

/** Frase corta aprobada por el dueño (auditoría 2026-11-03) para el tooltip de la tarjeta de /search. */
const COMPACT_TIP = "Referencial: el importe final lo confirma la residencia según el tipo de cambio.";

/**
 * Docs/08 §9.9: aviso breve reutilizable, siempre junto a un monto convertido de USD a ARS.
 * `showNote` suma la frase corta siempre visible («Referencial · el importe final lo confirma la residencia»)
 * al lado del botón «i»; el texto oficial completo sigue en el panel que abre el botón.
 * `compact` (tarjeta de /search): solo el botón «i», con la frase corta en un tooltip (hover/foco en escritorio); al tocar abre el panel oficial.
 * Botón de 44px (área táctil), `aria-controls`, cierra con Esc / «Entendido» / clic afuera y devuelve el foco.
 */
export function ExchangeRateNote({ showNote = false, compact = false }: { showNote?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      // Solo si el foco está dentro de la nota: no cierra un visor/diálogo padre.
      if (event.key === "Escape" && containerRef.current?.contains(document.activeElement)) {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <span ref={containerRef} className={`group/rn relative inline-flex align-middle ${showNote ? "max-w-full items-start gap-0.5" : ""}`}>
      {showNote && (
        <span className="text-xs font-semibold text-ink-soft">Referencial · el importe final lo confirma la residencia</span>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Más información sobre el valor en pesos"
        className={
          compact
            ? "inline-flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-forest"
            : `-mb-3 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-forest ${showNote ? "-mt-3.5" : "-mt-3"}`
        }
      >
        <span
          aria-hidden="true"
          className="inline-flex size-5 items-center justify-center rounded-full border border-muted text-xs font-bold leading-none text-muted"
        >
          i
        </span>
      </button>
      {compact && !open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+4px)] -left-20 z-20 hidden w-56 rounded-field bg-ink px-3 py-2 text-left text-[12.5px] font-medium leading-snug text-white shadow-float [@media(hover:hover)]:group-focus-within/rn:block [@media(hover:hover)]:group-hover/rn:block"
        >
          {COMPACT_TIP}
        </span>
      )}
      {open && (
        <span
          id={panelId}
          role="region"
          aria-label="Valor en pesos referencial"
          className={`absolute bottom-full z-20 mb-2 w-64 max-w-[80vw] rounded-field border-[1.5px] border-line bg-paper p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-float ${
            showNote || compact ? "left-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {compact && <b className="mb-1 block font-semibold text-ink">{COMPACT_TIP}</b>}
          {EXCHANGE_RATE_DISCLAIMER}
          <button
            type="button"
            onClick={close}
            className="mt-2 block min-h-11 rounded-full px-3 text-xs font-bold text-forest-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-forest"
          >
            Entendido
          </button>
        </span>
      )}
    </span>
  );
}
