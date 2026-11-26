"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { isDevUi } from "@/lib/dev/devUi";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = {
  sm: "sm:max-w-[540px]",
  /** Entrada `/`: 600 px, para que entre completa sin scroll en desktop. */
  entry: "sm:max-w-[600px]",
  md: "sm:max-w-[680px]",
  /** Fundadoras, solicitud enviada y legales: 660 px. */
  mid: "sm:max-w-[660px]",
  /** «Mi lugar»: 820 px. */
  lugar: "sm:max-w-[820px]",
  /** Paso 2 (formulario + vista previa): 880 px. */
  form: "sm:max-w-[880px]",
  /** Paso 1 y registro familiar (panel lateral + formulario): 920 px. */
  wide: "sm:max-w-[920px]",
  lg: "sm:max-w-[980px]",
} as const;

/**
 * Popup de la preapertura (DR42.5, docs/23 §2). `role="dialog"` + `aria-modal`; recibe el foco al entrar (en `initialFocus`, un
 * selector CSS, o en el primer elemento enfocable), lo mantiene adentro (Tab/Shift+Tab circulan) y lo devuelve al cerrarse.
 * Menos de 640 px es una hoja inferior flotante (margen de 10 px, alto máximo = pantalla menos 92 px) con manija y scroll interno;
 * desde 640 px, tarjeta centrada con margen de al menos 48 px.
 *
 * REGLA DEL DUEÑO: en PRODUCCIÓN el popup NO SE PUEDE CERRAR NUNCA: ni con Esc, ni con clic afuera, ni con un botón (no hay
 * handler de Escape ni de clic en el fondo, y el fondo blureado es inerte). EXCEPCIÓN SOLO EN DESARROLLO
 * (`process.env.NODE_ENV === "development"`): si se pasa `onDevClose`, se dibuja el botón visible «Cerrar (solo dev)» arriba del
 * popup para ocultarlo y revisar la landing blureada sin blur. Next elimina esa rama del build de producción.
 *
 * `aside` se renderiza dentro del diálogo pero fuera de su caja (p. ej. la tarjeta lateral de fundadoras), así queda dentro del
 * orden de tabulación y del árbol accesible. Con `asideBeside`, desde 1100 px la caja y la lateral van en fila, centradas y
 * separadas 20 px (600 + 20 + 340 + márgenes). Con `fullOnMobile`, debajo de 640 px el popup ocupa casi toda la pantalla, sin manija,
 * con 10 px de margen y bordes redondeados para que se lea como popup sobre la página (DR71 b). Con aviso de cookies deja su
 * espacio arriba: `.pre-full` en `preapertura.css`.
 */
export function PreaperturaDialog({
  labelledBy,
  describedBy,
  size = "sm",
  initialFocus,
  onDevClose,
  aside,
  asideBeside = false,
  fullOnMobile = false,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  size?: keyof typeof SIZES;
  /** Selector CSS del elemento que recibe el foco al abrir (p. ej. el CTA principal). */
  initialFocus?: string;
  /** Solo se usa en desarrollo: nunca existe un cierre en producción. */
  onDevClose?: () => void;
  aside?: ReactNode;
  asideBeside?: boolean;
  fullOnMobile?: boolean;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // OJO: NO se bloquea el scroll del documento (nada de `overflow: hidden` en <html>): la página de atrás se desplaza con rueda, touch
    // y teclado mientras el popup flota fijo.
    // El contenido ya está montado (no hay portal): se enfoca de inmediato, sin esperar un frame.
    const root = wrapperRef.current;
    const target =
      (initialFocus ? root?.querySelector<HTMLElement>(initialFocus) : null) ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
    return () => {
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [initialFocus]);

  /**
   * Teclado: trampa de foco (Tab) + scroll de la página de atrás. Sin Esc a propósito: el popup no se cierra (ver doc del componente).
   * El navegador NO desplaza el documento con teclas (PageDown, espacio, flechas, Inicio/Fin) cuando el foco está dentro de un elemento
   * `fixed` con su propio contenedor de scroll: lo hacemos nosotros. Si el contenido del popup todavía puede desplazarse en esa dirección
   * se deja el comportamiento nativo (scrollea el popup); si no, desplaza el documento. No se toca nada dentro de campos de texto,
   * selects ni botones (donde esas teclas significan otra cosa).
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      // El aviso de cookies (`data-cookie-notice`, fuera del popup) entra en el ciclo de Tab: va primero en el DOM y así es alcanzable.
      const notice = document.querySelector<HTMLElement>("[data-cookie-notice]");
      const nodes = [...Array.from(notice?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []), ...Array.from(wrapperRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inside = wrapperRef.current?.contains(active) || notice?.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, summary, [contenteditable='true']")) return;
    const viewport = window.innerHeight;
    let delta = 0;
    let toEdge: "top" | "bottom" | null = null;
    switch (event.key) {
      case "PageDown": delta = viewport * 0.9; break;
      case "PageUp": delta = -viewport * 0.9; break;
      case " ": delta = event.shiftKey ? -viewport * 0.9 : viewport * 0.9; break;
      case "ArrowDown": delta = 48; break;
      case "ArrowUp": delta = -48; break;
      case "Home": toEdge = "top"; break;
      case "End": toEdge = "bottom"; break;
      default: return;
    }
    const scroller = target.closest<HTMLElement>("[data-dialog-scroll]");
    const canScrollInside =
      scroller != null &&
      (toEdge === "top" || delta < 0 ? scroller.scrollTop > 0 : scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1);
    if (canScrollInside) return; // el popup todavía tiene contenido en esa dirección: scroll nativo
    event.preventDefault();
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (toEdge) window.scrollTo({ top: toEdge === "top" ? 0 : document.documentElement.scrollHeight, behavior });
    else window.scrollBy({ top: delta, behavior });
  }

  const devClose = isDevUi() && onDevClose;

  return (
    <div
      ref={wrapperRef}
      onKeyDown={onKeyDown}
      className={`pointer-events-none fixed inset-0 z-[60] flex justify-center sm:items-center sm:p-12 ${
        fullOnMobile ? "pre-full items-stretch p-2.5" : "items-end p-2.5"
      } ${asideBeside ? "min-[1100px]:gap-5" : ""}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`animate-dialog-center pointer-events-auto relative w-full sm:max-h-[calc(100dvh-96px)] ${
          fullOnMobile ? "h-full sm:h-auto" : "max-h-[calc(100dvh-92px)]"
        } ${SIZES[size]}`}
      >
        {devClose && (
          <button
            type="button"
            onClick={onDevClose}
            className={`${fullOnMobile ? "right-3 top-3 sm:-top-12 sm:right-0" : "-top-12 right-0"} absolute z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-paper bg-forest-ink px-4 text-sm font-bold whitespace-nowrap text-paper shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)]`}
          >
            <Icon name="close" className="text-lg" />
            Cerrar (solo dev)
          </button>
        )}
        <div
          data-dialog-scroll
          className={`@container overflow-y-auto overscroll-contain rounded-card bg-paper shadow-float sm:max-h-[inherit] ${
            fullOnMobile ? "h-full sm:h-auto" : "max-h-[inherit]"
          }`}
        >
          {!fullOnMobile && <div data-dialog-handle aria-hidden="true" className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-field-border/50 sm:hidden" />}
          {children}
        </div>
      </div>
      {aside}
    </div>
  );
}
