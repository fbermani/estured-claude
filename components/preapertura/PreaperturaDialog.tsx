"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = {
  sm: "sm:max-w-[540px]",
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
 * `aside` se renderiza dentro del diálogo pero fuera de su caja (p. ej. la tarjeta de fundadoras fija abajo a la derecha), así
 * queda dentro del orden de tabulación y del árbol accesible.
 */
export function PreaperturaDialog({
  labelledBy,
  describedBy,
  size = "sm",
  initialFocus,
  onDevClose,
  aside,
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
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // El contenido ya está montado (no hay portal): se enfoca de inmediato, sin esperar un frame.
    const root = wrapperRef.current;
    const target =
      (initialFocus ? root?.querySelector<HTMLElement>(initialFocus) : null) ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [initialFocus]);

  // Trampa de foco. Sin tecla Esc a propósito: el popup no se cierra (ver doc del componente).
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = Array.from(wrapperRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.getClientRects().length > 0,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !wrapperRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !wrapperRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  const devClose = process.env.NODE_ENV === "development" && onDevClose;

  return (
    <div
      ref={wrapperRef}
      onKeyDown={onKeyDown}
      className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center p-2.5 sm:items-center sm:p-12"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`animate-dialog-center pointer-events-auto relative w-full max-h-[calc(100dvh-92px)] sm:max-h-[calc(100dvh-96px)] ${SIZES[size]}`}
      >
        {devClose && (
          <button
            type="button"
            onClick={onDevClose}
            className="absolute -top-12 right-0 inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-paper bg-forest-ink px-4 text-sm font-bold whitespace-nowrap text-paper shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink focus-visible:shadow-[0_0_0_2px_var(--color-paper)]"
          >
            <Icon name="close" className="text-lg" />
            Cerrar (solo dev)
          </button>
        )}
        <div className="@container max-h-[inherit] overflow-y-auto overscroll-contain rounded-card bg-paper shadow-float">
          <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-field-border/50 sm:hidden" />
          {children}
        </div>
      </div>
      {aside}
    </div>
  );
}
