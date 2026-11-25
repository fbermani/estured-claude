"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CONSENT_EVENT, readConsent, shouldShowCookieNotice, writeConsent, type Consent } from "@/lib/analytics/consent";

const button =
  "inline-flex min-h-9 flex-1 items-center justify-center rounded-full border-2 border-forest-ink bg-paper px-4 text-sm font-bold text-forest-ink transition-colors hover:bg-cream-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink sm:flex-none";

/**
 * Aviso simple de cookies (decisión del dueño 2026-11-22). Solo existe si el pixel está configurado (`pixelId` lo resuelve el
 * servidor) y la persona todavía no eligió. Dos botones del mismo peso, ninguno preseleccionado; la elección queda en `er-consent`.
 *
 * Va FUERA del contenido inerte de la preapertura (hermano de `<main>` en el layout), fijo arriba: en menos de 640 px el popup es una
 * hoja inferior que deja libres unos 82 px arriba, y desde 640 px el popup centrado deja 48 px: el aviso mide menos que eso, así que
 * no tapa los botones del popup. Tiene `data-cookie-notice`: la trampa de foco del popup (`PreaperturaDialog`) lo incluye en el Tab.
 * Sin animación de movimiento.
 */
export function CookieNotice({ pixelId }: { pixelId: string | null }) {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // `undefined` = todavía no leímos la cookie (render del servidor): no dibujar nada evita un destello.
  if (consent === undefined || !shouldShowCookieNotice(pixelId, consent)) return null;

  function choose(value: Consent) {
    const hadFocus = ref.current?.contains(document.activeElement) ?? false;
    const saved = writeConsent(value, window.location.protocol === "https:");
    // Con cookies bloqueadas no se puede recordar: se respeta la elección en esta pantalla y el aviso se cierra igual.
    if (!saved) setConsent(value);
    if (hadFocus) document.querySelector<HTMLElement>('[role="dialog"] :is(a[href], button, input, select, textarea)')?.focus({ preventScroll: true });
  }

  return (
    <section
      ref={ref}
      data-cookie-notice
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 top-0 z-[70] flex flex-col gap-1 border-b border-line-2 bg-paper px-3 py-1.5 shadow-float sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
    >
      <p className="text-xs text-ink-soft sm:text-sm">
        Cookies de Meta para medir campañas.{" "}
        <Link href="/privacy" className="rounded-sm font-semibold text-forest-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
          Privacidad
        </Link>
      </p>
      <div className="flex gap-2 sm:shrink-0">
        <button type="button" onClick={() => choose("granted")} className={button}>
          Aceptar
        </button>
        <button type="button" onClick={() => choose("denied")} className={button}>
          Solo las necesarias
        </button>
      </div>
    </section>
  );
}
