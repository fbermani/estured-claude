/**
 * URL base con la que se arma el link de la ficha que se comparte por WhatsApp. Nunca lanza ni devuelve `localhost`:
 * `NEXT_PUBLIC_APP_URL` (la oficial del despliegue) > `NEXT_PUBLIC_SITE_URL` > el dominio de staging (`https://estured.vercel.app`).
 * Sin `server-only`: solo lee variables públicas.
 */
export const SHARE_FALLBACK_BASE_URL = "https://estured.vercel.app";

export function getShareBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const candidates = [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_SITE_URL];
  for (const raw of candidates) {
    const value = raw?.trim().replace(/\/+$/, "");
    if (value && /^https?:\/\//i.test(value) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(value)) return value;
  }
  return SHARE_FALLBACK_BASE_URL;
}
