"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, attributionFromSearch, parseAttributionCookie, serializeAttributionCookie } from "@/lib/attribution/attribution";

/**
 * Guarda en la cookie propia `er-attr` los parámetros de campaña de la URL (primer toque, 30 días). No pisa una atribución
 * existente y no hace nada si la URL no trae parámetros. Sin datos personales. No dibuja nada.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const existing = document.cookie
        .split("; ")
        .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
        ?.slice(ATTRIBUTION_COOKIE.length + 1);
      if (parseAttributionCookie(existing)) return;
      const attribution = attributionFromSearch(window.location.search);
      if (!attribution) return;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${ATTRIBUTION_COOKIE}=${serializeAttributionCookie(attribution)}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Cookies bloqueadas: la atribución es opcional y el sitio sigue igual.
    }
  }, []);
  return null;
}
