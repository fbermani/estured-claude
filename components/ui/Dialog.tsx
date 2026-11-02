"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible compartido (Ciclo 60). Dos formas:
 *  - `center`: modal centrado en desktop y hoja inferior (radio 24 px arriba, 94 vh) en mobile.
 *  - `side`: hoja lateral derecha de `sideWidth` px en desktop y pantalla casi completa en mobile.
 * Accesibilidad: `role="dialog"` + `aria-modal`, foco inicial en `[data-autofocus]` (o el primer foco), trampa de foco,
 * Esc y clic en el fondo cierran (salvo `dismissible={false}`), el foco vuelve al disparador y se bloquea el scroll del body.
 * Se monta solo abierto (el contenido guarda su estado mientras el diálogo no se cierre).
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  placement = "center",
  maxWidthClass = "sm:max-w-lg",
  sideWidthClass = "sm:w-[560px]",
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  placement?: "center" | "side";
  maxWidthClass?: string;
  sideWidthClass?: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const el = dialogRef.current;
      const target = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && dismissible) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const panelClasses =
    placement === "side"
      ? `absolute bottom-0 right-0 top-3 flex w-full flex-col overflow-hidden rounded-t-[24px] bg-paper shadow-float sm:top-0 ${sideWidthClass} sm:rounded-l-[24px] sm:rounded-tr-none`
      : `relative mt-auto flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-paper shadow-float sm:mb-auto sm:max-h-[90vh] sm:rounded-card ${maxWidthClass}`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] ${placement === "center" ? "flex items-stretch justify-center sm:items-center sm:p-6" : ""}`}
    >
      <div
        className="absolute inset-0 bg-forest-ink/40 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        className={`${panelClasses} ${placement === "center" ? "sm:my-auto" : ""}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
