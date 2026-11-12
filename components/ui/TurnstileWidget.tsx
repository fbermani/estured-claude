"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Carga el script de Cloudflare una sola vez (deduplicado por id) y resuelve cuando `window.turnstile` está listo. */
function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile no disponible"))));
    script.addEventListener("error", () => reject(new Error("no se pudo cargar turnstile")));
  });
}

/**
 * CAPTCHA de Cloudflare Turnstile. Agrega solo el input hidden `cf-turnstile-response` dentro del formulario; el servidor lo valida
 * con `verifyTurnstile`. Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no renderiza nada. Los tokens son de un solo uso: pasale como `resetKey`
 * el `state` del `useActionState` para pedir uno nuevo después de cada envío.
 */
export function TurnstileWidget({ resetKey }: { resetKey?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetIdRef.current = api.render(container, {
          sitekey: siteKey,
          language: "es",
          theme: "light",
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (widgetIdRef.current !== null && window.turnstile) window.turnstile.reset(widgetIdRef.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="min-h-[65px]" />;
}
