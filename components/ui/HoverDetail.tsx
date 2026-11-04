"use client";

import { useId, useState, type ReactNode, type KeyboardEvent } from "react";

/**
 * Envoltorio interactivo reutilizable para filas/tarjetas de listas
 * (pasos, features de plan, comparaciones): hover en desktop, click/tap
 * en mobile, foco por teclado — todos disparan el mismo estado `open`,
 * que se pasa a `children` como render-prop para que cada consumidor
 * decida qué resaltar (ícono, número, peso de texto) sin que este
 * componente conozca esos detalles. Debajo se expande `detail` con
 * fade + slide (grid-template-rows 0fr→1fr, sin medir alturas a mano).
 */
export function HoverDetail({
  detail,
  children,
  className = "",
}: {
  detail: string;
  children: (open: boolean) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  function toggle() {
    setOpen((o) => !o);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-controls={detailId}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={`cursor-pointer rounded-field transition duration-200 ease-out-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
        open ? "-translate-y-0.5 scale-[1.02] shadow-card-hover" : ""
      } ${className}`}
    >
      {children(open)}
      <div
        id={detailId}
        aria-hidden={!open}
        inert={!open}
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-fresh"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">{detail}</p>
        </div>
      </div>
    </div>
  );
}
