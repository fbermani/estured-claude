"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ResidencePlate } from "@/components/residences/ficha/ResidencePlate";
import type { ReservationWindowNotice } from "@/lib/students/reservationWindow";
import { useReservationSelection } from "@/components/residences/reservationSelection";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MOBILE_QUERY = "(max-width: 899px)";

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const getMobileServer = () => false;

/**
 * Panel de solicitud de la ficha: la columna derecha fija en escritorio (≥ 900 px) y, en móvil, una hoja inferior
 * modal que abre la barra «Elegir habitación». Es UN solo elemento en el árbol (los formularios se montan una vez):
 * solo cambia su presentación con CSS. Envuelve `ApplyForm` / `ProposeForm` / el contenido del visitante (modo
 * `request`) o `JoinWaitlistForm` (modo `waitlist`). El encabezado y el pie del formulario quedan fijos y solo el
 * cuerpo scrollea.
 *
 * En escritorio el panel es `sticky` y arranca DEBAJO de la navbar y de la tira de capítulos (`top` = ambas alturas + 1 rem, de
 * `--ficha-navbar-h` y `--ficha-chips-h`, definidas por la página con `lib/residences/fichaLayout.ts`), así su cabecera nunca queda
 * tapada; su alto máximo es lo que queda del viewport y el cuerpo scrollea por dentro.
 *
 * `role="dialog"`, `aria-modal`, trampa de foco, Esc, bloqueo del scroll y retorno del foco solo aplican en móvil.
 * En escritorio, «Elegir» (`openSheet`) selecciona el tipo y lleva el foco al primer campo del panel, sin modal.
 */
export function RequestPanel({
  residenceName,
  zone = null,
  variant,
  requestContent,
  waitlistContent,
  canRequest,
  windowNotice,
}: {
  residenceName: string;
  /** Barrio de la residencia, para la placa chica de arriba del panel (escritorio). */
  zone?: string | null;
  /** Reserva vigente: se avisa arriba del formulario (el selector de fecha ya viene acotado). */
  windowNotice?: ReservationWindowNotice | null;
  /** `guest`: visitante sin sesión (elige el tipo y sigue por el ingreso). */
  variant: "apply" | "propose" | "guest";
  requestContent: ReactNode;
  waitlistContent?: ReactNode;
  /** ¿Hay algún tipo que se pueda solicitar? Si sí, desde la lista de espera se puede volver a la solicitud. */
  canRequest: boolean;
}) {
  const { panelMode, setPanelMode, sheetOpen, closeSheet, openTick, registerSheet } = useReservationSelection();
  const isMobile = useSyncExternalStore(subscribeMobile, getMobile, getMobileServer);
  const modalOpen = isMobile && sheetOpen;
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const panelModeRef = useRef(panelMode);
  useEffect(() => {
    panelModeRef.current = panelMode;
  }, [panelMode]);

  useEffect(() => {
    if (variant === "guest") return;
    return registerSheet();
  }, [registerSheet, variant]);

  // Escritorio: un pedido de «Elegir» (o la vuelta del login con `?solicitar=1`) lleva el foco al panel.
  useEffect(() => {
    if (openTick === 0 || window.matchMedia(MOBILE_QUERY).matches) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.scrollIntoView({ block: "nearest" });
      const visible = (el: HTMLElement) => el.offsetParent !== null;
      // Solicitud: la fecha de ingreso (el tipo ya quedó elegido); lista de espera: su primer campo.
      const wanted = panelModeRef.current === "waitlist" ? ["select, input:not([type=hidden])"] : ['input[type="date"]', 'input[type="radio"]'];
      for (const selector of wanted) {
        const target = Array.from(panel.querySelectorAll<HTMLElement>(selector)).find(visible);
        if (target) {
          target.focus({ preventScroll: true });
          break;
        }
      }
    });
    closeSheet();
    return () => cancelAnimationFrame(frame);
  }, [openTick, closeSheet]);

  // Móvil: la hoja abierta bloquea el scroll, enfoca su primer campo y devuelve el foco al cerrar.
  useEffect(() => {
    if (!modalOpen) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const body = panel?.querySelector<HTMLElement>("[data-panel-body]");
      // El tipo ya elegido, o el primer campo visible del paso en curso («Volver» en el paso 2).
      const shown = (el: HTMLElement) => el.getClientRects().length > 0;
      const first =
        Array.from(body?.querySelectorAll<HTMLElement>("input[type=radio]:checked") ?? []).find(shown) ??
        Array.from(body?.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea, button") ?? []).find(shown);
      (first ?? panel?.querySelector<HTMLElement>("[data-close]"))?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus?.({ preventScroll: true });
    };
  }, [modalOpen]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isMobile || !sheetOpen) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null || el.matches("input.sr-only"),
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

  const isWaitlist = panelMode === "waitlist" && !!waitlistContent;
  const title = isWaitlist ? "Lista de espera" : variant === "propose" ? "Proponer esta residencia" : "Tu solicitud de reserva";
  const description = isWaitlist
    ? "Sumarte a la lista de espera no es una solicitud ni reserva un lugar. Te avisamos si se libera uno."
    : variant === "propose"
      ? "Una propuesta no es una solicitud: tu estudiante la ve en su panel y decide si la envía."
      : "Sujeta a confirmación de la residencia.";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeSheet}
        className={`fixed inset-0 z-[59] bg-[rgb(18_30_24/0.5)] backdrop-blur-[3px] transition-opacity duration-300 motion-reduce:transition-none min-[900px]:hidden ${
          sheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role={isMobile ? "dialog" : "region"}
        aria-modal={isMobile ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-hidden={isMobile && !sheetOpen ? true : undefined}
        inert={isMobile && !sheetOpen}
        onKeyDown={onKeyDown}
        data-residence={residenceName}
        className={`flex flex-col overflow-hidden bg-paper transition-[transform,opacity] duration-300 ease-[var(--ease-out-fresh)] motion-reduce:transition-none min-[900px]:sticky min-[900px]:top-[calc(var(--ficha-navbar-h,4.0625rem)_+_var(--ficha-chips-h,3.9rem)_+_1rem)] min-[900px]:max-h-[calc(100dvh_-_var(--ficha-navbar-h,4.0625rem)_-_var(--ficha-chips-h,3.9rem)_-_2rem)] min-[900px]:rounded-card min-[900px]:border-[1.5px] min-[900px]:border-line min-[900px]:shadow-card max-[899px]:fixed max-[899px]:inset-x-0 max-[899px]:bottom-0 max-[899px]:z-[60] max-[899px]:max-h-[calc(100dvh-2.5rem)] max-[899px]:rounded-t-[24px] max-[899px]:shadow-float ${
          sheetOpen ? "" : "max-[899px]:pointer-events-none max-[899px]:translate-y-full max-[899px]:opacity-0"
        }`}
      >
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-2 min-[900px]:hidden" />
        {/* Placa chica (escritorio): el nombre y el sello acompañan al panel mientras se scrollea la ficha. */}
        <div className="hidden shrink-0 px-5 pt-5 sm:px-6 min-[900px]:block">
          <ResidencePlate variant="panel" name={residenceName} zone={zone} />
        </div>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-4 sm:px-6 min-[900px]:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold leading-snug text-ink">
              {title}
            </h2>
            <p id={descId} className="mt-0.5 text-sm text-ink-soft">
              {description}
            </p>
          </div>
          <button
            type="button"
            data-close
            onClick={closeSheet}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream-2 text-ink transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest min-[900px]:hidden"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </header>
        {windowNotice && variant === "apply" && (
          <p
            className={`flex shrink-0 items-start gap-2 border-b border-line px-5 py-2.5 text-xs leading-relaxed sm:px-6 ${
              windowNotice.stayChangeOpen ? "bg-warning-bg text-warning-fg" : "bg-info-bg text-info-fg"
            }`}
          >
            {windowNotice.stayChangeOpen && <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-base" />}
            <span>{windowNotice.message}</span>
          </p>
        )}
        {isWaitlist && canRequest && (
          <button
            type="button"
            onClick={() => setPanelMode("request")}
            className="flex shrink-0 items-center gap-1 border-b border-line px-5 py-2.5 text-left text-sm font-bold text-forest-700 hover:bg-forest-tint sm:px-6"
          >
            <Icon name="chevron_left" className="text-lg" />
            Volver a la solicitud
          </button>
        )}
        <div data-panel-body className="flex min-h-0 flex-1 flex-col">
          <div className={isWaitlist ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{requestContent}</div>
          {waitlistContent && <div className={isWaitlist ? "flex min-h-0 flex-1 flex-col" : "hidden"}>{waitlistContent}</div>}
        </div>
      </div>
    </>
  );
}

/**
 * Barra inferior fija para pantallas de menos de 900 px: la «numeración» de la placa (precio «desde» con su referencia en ARS) y la CTA
 * naranja que abre el panel como hoja modal. Es la única CTA que late en móvil. Respeta el área segura del iPhone.
 */
export function RequestMobileBar({ fromPriceUsd, arsPerUsd, label }: { fromPriceUsd: number; arsPerUsd: number; label: string }) {
  const { openSheet, sheetOpen } = useReservationSelection();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line-2 bg-paper/95 px-4 pt-2.5 shadow-[0_-6px_18px_rgba(29,39,34,0.08)] backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))] min-[900px]:hidden">
      <ResidencePlate variant="bar" fromPriceUsd={fromPriceUsd} arsPerUsd={arsPerUsd} />
      <Button
        type="button"
        variant="cta"
        size="cta-bar"
        pulse
        onClick={() => openSheet("request")}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        className="shrink-0 whitespace-nowrap max-[359px]:px-3.5"
      >
        {label}
      </Button>
    </div>
  );
}
