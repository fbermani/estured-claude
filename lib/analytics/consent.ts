/**
 * Consentimiento de cookies de medición (decisión del dueño 2026-11-22: aviso simple antes de cargar el pixel de Meta).
 * Cookie propia `er-consent` = `granted` | `denied`, 180 días. Módulo puro, sin `server-only`: lo usan el aviso, el pixel y los tests.
 * La cookie `er-attr` (atribución first-party) NO depende de esta elección.
 */

export const CONSENT_COOKIE = "er-consent";
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
/** Evento de `window` que avisa el cambio de elección dentro de la misma sesión (sin recargar). */
export const CONSENT_EVENT = "er-consent-change";

export type Consent = "granted" | "denied";

/** Lee la elección del texto de `document.cookie`. Cualquier valor ajeno o ausente da null (todavía no eligió). */
export function parseConsent(cookieHeader: string | null | undefined): Consent | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const piece = part.trim();
    if (!piece.startsWith(`${CONSENT_COOKIE}=`)) continue;
    const value = piece.slice(CONSENT_COOKIE.length + 1);
    return value === "granted" || value === "denied" ? value : null;
  }
  return null;
}

/** Texto de `Set-Cookie` (vía `document.cookie`): SameSite=Lax, `Secure` solo si la página va por https. */
export function serializeConsentCookie(value: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

type CookieDoc = { cookie: string };

/** Lee la elección guardada. Con cookies bloqueadas o sin documento devuelve null. */
export function readConsent(doc: CookieDoc | null = typeof document === "undefined" ? null : document): Consent | null {
  try {
    return doc ? parseConsent(doc.cookie) : null;
  } catch {
    return null;
  }
}

/** Guarda la elección y avisa a la página. Devuelve false si el navegador bloquea cookies (el aviso reaparecería en la próxima visita). */
export function writeConsent(
  value: Consent,
  secure: boolean,
  doc: CookieDoc | null = typeof document === "undefined" ? null : document,
  target: { dispatchEvent: (event: Event) => boolean } | null = typeof window === "undefined" ? null : window,
): boolean {
  if (!doc) return false;
  try {
    doc.cookie = serializeConsentCookie(value, secure);
  } catch {
    return false;
  }
  target?.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  return true;
}

/** El aviso solo existe si el pixel está configurado (mismo criterio del servidor) y todavía no hay elección. */
export function shouldShowCookieNotice(pixelId: string | null, consent: Consent | null): boolean {
  return Boolean(pixelId) && consent === null;
}
