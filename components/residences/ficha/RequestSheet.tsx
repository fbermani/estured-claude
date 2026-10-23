"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ReservationWindowNotice } from "@/lib/students/reservationWindow";
import { useReservationSelection } from "@/components/residences/reservationSelection";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja de solicitud (SPEC §4.3): lateral de 500 px en desktop, inferior a casi pantalla completa en mobile.
 * Envuelve `ApplyForm` / `ProposeForm` (modo `request`) o `JoinWaitlistForm` (modo `waitlist`). El encabezado y
 * el pie del formulario quedan fijos y solo el cuerpo scrollea, así el botón de enviar nunca queda cortado (D20).
 *
 * Los formularios quedan montados aunque la hoja esté cerrada (con `inert`), para que cerrarla no borre lo que
 * la persona ya cargó. Accesibilidad: `role="dialog"` + `aria-modal`, foco inicial en el primer campo, trampa de
 * foco, Esc y clic en el fondo cierran, el foco vuelve al disparador y el scroll de la página se bloquea.
 */
export function RequestSheet({
  residenceName,
  variant,
  requestContent,
  waitlistContent,
  windowNotice,
}: {
  residenceName: string;
  /** Reserva vigente: se avisa arriba del formulario (el selector de fecha ya viene acotado). */
  windowNotice?: ReservationWindowNotice | null;
  variant: "apply" | "propose";
  requestContent: ReactNode;
  waitlistContent?: ReactNode;
}) {
  const { sheet, closeSheet } = useReservationSelection();
  const open = sheet !== null;
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco inicial: el primer campo del formulario visible (el selector de tipo); si no hay, el botón de cerrar.
    const frame = requestAnimationFrame(() => {
      const visible = Array.from(bodyRef.current?.children ?? []).find((c) => !c.classList.contains("hidden"));
      const first = visible?.querySelector<HTMLElement>("select, input:not([type=hidden]), textarea, button");
      (first ?? dialogRef.current?.querySelector<HTMLElement>("[data-close]"))?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeSheet();
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

  const isWaitlist = sheet === "waitlist";
  const title = isWaitlist ? "Lista de espera" : variant === "propose" ? "Proponer esta residencia" : "Tu solicitud de reserva";
  const description = isWaitlist
    ? "Sumarte a la lista de espera no es una solicitud ni reserva un lugar. Te avisamos si se libera uno."
    : variant === "propose"
      ? "Una propuesta no es una solicitud: tu estudiante la ve en su panel y decide si la envía."
      : "Sujeta a confirmación de la residencia.";

  return (
    <div
      className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        onClick={closeSheet}
        className={`absolute inset-0 bg-[rgb(18_30_24/0.5)] backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className={`absolute bottom-0 right-0 top-3 flex w-full flex-col overflow-hidden rounded-t-[24px] bg-paper shadow-float transition-transform duration-300 ease-[var(--ease-out-fresh)] motion-reduce:transition-none sm:top-0 sm:w-[500px] sm:rounded-l-[24px] sm:rounded-tr-none ${
          open ? "translate-x-0 translate-y-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"
        }`}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-2 sm:hidden" />
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted">{residenceName}</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-ink">
              {title}
            </h2>
            <p id={descId} className="mt-1 text-sm text-ink-soft">
              {description}
            </p>
          </div>
          <button
            type="button"
            data-close
            onClick={closeSheet}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream-2 text-ink transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:h-9 sm:w-9"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </header>
        {windowNotice && variant === "apply" && (
          <p className="shrink-0 border-b border-line bg-info-bg px-5 py-2.5 text-xs leading-relaxed text-info-fg sm:px-6">
            {windowNotice.message}
          </p>
        )}
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
          <div className={isWaitlist ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{requestContent}</div>
          {waitlistContent && <div className={isWaitlist ? "flex min-h-0 flex-1 flex-col" : "hidden"}>{waitlistContent}</div>}
        </div>
      </div>
    </div>
  );
}
