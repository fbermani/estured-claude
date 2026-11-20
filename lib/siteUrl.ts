/** URL base pública del sitio (sin barra final). Configurable con NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://estured.com").replace(/\/+$/, "");
