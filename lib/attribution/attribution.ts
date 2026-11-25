/**
 * Atribución first-party de la preapertura (Paso 0 del runbook, «Medición sin Meta»): qué pieza trae a cada preregistro.
 * Se guardan SOLO los parámetros de campaña de la URL (nada personal), en la cookie propia `er-attr` (primer toque, 30 días).
 * Módulo puro, sin `server-only`: lo usan el cliente (captura), el servidor (lectura al guardar) y los tests.
 */

export const ATTRIBUTION_COOKIE = "er-attr";
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const ATTRIBUTION_MAX_LENGTH = 100;
export const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;

/** Recorta, quita lo que no sea texto de campaña (letras, números y puntuación simple) y limita a 100 caracteres. Vacío = null. */
export function sanitizeAttributionValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} _.\-~+:/@|,%]/gu, "")
    .trim()
    .slice(0, ATTRIBUTION_MAX_LENGTH)
    .trim();
  return clean ? clean : null;
}

/** Deja solo las claves conocidas con valor saneado. Sin ninguna clave válida devuelve null (nunca un objeto vacío). */
export function sanitizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const out: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = sanitizeAttributionValue(source[key]);
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** Arma la atribución desde un `location.search` (o cualquier query string). Sin parámetros de campaña: null. */
export function attributionFromSearch(search: string): Attribution | null {
  const params = new URLSearchParams(search);
  const raw: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  return sanitizeAttribution(raw);
}

/** Valor de la cookie (JSON codificado para cookie). */
export function serializeAttributionCookie(attribution: Attribution): string {
  return encodeURIComponent(JSON.stringify(attribution));
}

/** Lee y revalida el valor de la cookie. Cualquier cosa rota o manipulada da null. */
export function parseAttributionCookie(value: string | null | undefined): Attribution | null {
  if (!value || value.length > 1_000) return null;
  try {
    return sanitizeAttribution(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

/** ¿El error de Supabase es «falta la columna attribution» (migración 0106 sin aplicar)? Permite guardar igual sin atribución. */
export function isMissingAttributionColumn(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const codes = ["42703", "PGRST204"];
  return /attribution/i.test(error.message ?? "") && (Boolean(error.code && codes.includes(error.code)) || /could not find|does not exist/i.test(error.message ?? ""));
}
