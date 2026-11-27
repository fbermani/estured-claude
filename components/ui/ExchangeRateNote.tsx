"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Docs/00 §13.3 (DR72): texto oficial, obligatorio en toda conversión USD → ARS.
 * `before`: precios antes de enviar la solicitud. `sent`: montos de una solicitud enviada. `renewal`: oferta de renovación.
 */
const EXCHANGE_RATE_DISCLAIMER = {
  before:
    "El valor en pesos es referencial, con el dólar blue (valor venta) de hoy. Para el pago de la reserva y el fee EstuRed, queda fija la cotización del día en que se envía la solicitud de reserva. Los pagos posteriores se acuerdan con la residencia.",
  sent: "Estos pesos usan el dólar blue (valor venta) del día en que se envió la solicitud de reserva. Esa cotización queda fija para el pago de la reserva y el fee EstuRed. Los pagos posteriores se acuerdan con la residencia.",
  renewal:
    "Estos pesos usan el dólar blue (valor venta) del día en que se creó la oferta de renovación. Esa cotización queda fija para el fee EstuRed.",
} as const;

/** Frase corta aprobada por el dueño (DR72) para `showNote` y el tooltip de `compact`. Solo en precios antes de enviar. */
const COMPACT_TIP = "Referencial · el pago de la reserva queda fijo en pesos al enviar la solicitud";

/**
 * Docs/08 §9.9: aviso breve reutilizable, siempre junto a un monto convertido de USD a ARS.
 * `showNote` suma la frase corta (`COMPACT_TIP`) siempre visible al lado del botón «i»;
 * el texto oficial completo sigue en el panel que abre el botón.
 * `compact` (tarjeta de /search): solo el botón «i», con la frase corta en un tooltip (hover/foco en escritorio); al tocar abre el panel oficial.
 * Botón de 44px (área táctil), `aria-controls`, cierra con Esc / «Entendido» / clic afuera y devuelve el foco.
 * `onDark`: la «i» y el foco en tonos paper, para usarla sobre fondos forest-ink (placa de la ficha).
 * `align="end"`: el panel y el tooltip se abren hacia la izquierda (la nota está pegada al borde derecho de su contenedor).
 */
export function ExchangeRateNote({
  showNote = false,
  compact = false,
  onDark = false,
  align = "start",
  variant = "before",
}: {
  showNote?: boolean;
  compact?: boolean;
  onDark?: boolean;
  align?: "start" | "end";
  variant?: "before" | "sent" | "renewal";
}) {
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

  const focusRing = onDark ? "focus-visible:outline-paper" : "focus-visible:outline-forest";
  const circleTone = onDark ? "border-[color:var(--paper-88)] text-[color:var(--paper-88)]" : "border-muted text-muted";
  const tipSide = align === "end" ? "right-0" : "-left-20";
  const panelSide = align === "end" ? "right-0" : showNote || compact ? "left-0" : "left-1/2 -translate-x-1/2";

  return (
    <span ref={containerRef} className={`group/rn relative inline-flex align-middle ${showNote ? "max-w-full items-start gap-0.5" : ""}`}>
      {showNote && (
        <span className="text-xs font-semibold text-ink-soft">{COMPACT_TIP}</span>
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
            ? `inline-flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${focusRing}`
            : `-mb-3 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${focusRing} ${showNote ? "-mt-3.5" : "-mt-3"}`
        }
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-5 items-center justify-center rounded-full border text-xs font-bold leading-none ${circleTone}`}
        >
          i
        </span>
      </button>
      {compact && !open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-[calc(100%+4px)] ${tipSide} z-20 hidden w-56 rounded-field bg-ink px-3 py-2 text-left text-[12.5px] font-medium leading-snug text-white shadow-float [@media(hover:hover)]:group-focus-within/rn:block [@media(hover:hover)]:group-hover/rn:block`}
        >
          {COMPACT_TIP}
        </span>
      )}
      {open && (
        <span
          id={panelId}
          role="region"
          aria-label="Valor en pesos"
          className={`absolute bottom-full z-20 mb-2 w-64 max-w-[80vw] rounded-field border-[1.5px] border-line bg-paper p-3 text-left text-xs font-normal leading-relaxed text-ink-soft shadow-float ${panelSide}`}
        >
          {compact && <b className="mb-1 block font-semibold text-ink">{COMPACT_TIP}</b>}
          {EXCHANGE_RATE_DISCLAIMER[variant]}
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
