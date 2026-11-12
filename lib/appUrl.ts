/**
 * URL base pública de la app, sin barra final.
 * En producción (VERCEL_ENV === "production") exige NEXT_PUBLIC_APP_URL: sin ella,
 * los links de mails y los QR de comprobantes (persistidos) quedarían en localhost.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL no está configurada en producción.");
  }
  return "http://localhost:3000";
}
