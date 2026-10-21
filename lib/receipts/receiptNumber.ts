/**
 * Número público de comprobante (el que se imprime y se tipea en /verify).
 *
 * Formato nuevo: `ER-AAAA-XXXXX-XXXXX` (reserva) / `ERR-AAAA-XXXXX-XXXXX`
 * (renovación), con 10 caracteres Crockford base32 (~50 bits) sacados de
 * `crypto.getRandomValues`. Reemplaza al formato viejo `ER-AAAA-XXXXXX`
 * (6 hex, 24 bits), que tenía riesgo real de colisión contra el índice
 * único y era fácil de barrer en /verify. Los números ya emitidos con el
 * formato viejo siguen siendo válidos (ver `normalizeReceiptNumber`).
 *
 * El alfabeto de Crockford excluye I, L, O y U para que se pueda tipear a
 * mano sin ambigüedades. 256 es múltiplo de 32, así que tomar el byte
 * módulo 32 no introduce sesgo.
 *
 * Sin `server-only` a propósito: lo usan generadores del servidor y tests.
 */

export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type ReceiptKind = "booking" | "renewal";

export function randomCrockford(length: number, getRandomValues: (a: Uint8Array) => Uint8Array = (a) => crypto.getRandomValues(a)): string {
  const bytes = getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += CROCKFORD_ALPHABET[bytes[i] % 32];
  return out;
}

export function generateReceiptNumber(kind: ReceiptKind, year: number = new Date().getFullYear()): string {
  const body = randomCrockford(10);
  return `${kind === "renewal" ? "ERR" : "ER"}-${year}-${body.slice(0, 5)}-${body.slice(5)}`;
}

/**
 * Lleva lo que tipeó una persona a la forma canónica, aceptando el formato
 * viejo (6 hex) y el nuevo (10 Crockford). Tolera minúsculas, espacios,
 * guiones faltantes y las confusiones típicas de Crockford (O→0, I/L→1).
 * `null` si no tiene forma de número de comprobante.
 */
export function normalizeReceiptNumber(raw: string): string | null {
  const compact = raw.replace(/[\s_-]+/g, "").toUpperCase();
  const match = /^(ERR?)(\d{4})([0-9A-Z]+)$/.exec(compact);
  if (!match) return null;
  const [, prefix, year, rest] = match;
  if (rest.length === 6 && /^[0-9A-F]{6}$/.test(rest)) return `${prefix}-${year}-${rest}`;
  if (rest.length === 10) {
    const fixed = rest.replace(/O/g, "0").replace(/[IL]/g, "1");
    if ([...fixed].every((c) => CROCKFORD_ALPHABET.includes(c))) return `${prefix}-${year}-${fixed.slice(0, 5)}-${fixed.slice(5)}`;
  }
  return null;
}

/**
 * Inserta un comprobante generando número y código de verificación nuevos en
 * cada intento y reintentando ante `23505` (unique_violation: colisión del
 * número, que es único). Hasta `maxAttempts` intentos; si igual falla,
 * devuelve el último error para que el llamador lo audite como siempre.
 * Los demás errores no se reintentan.
 *
 * Supuesto: hoy las únicas restricciones unique de `booking_receipts` y
 * `renewal_receipts` (aparte de la PK) son `receipt_number` y `verification_code`, y ambos
 * se regeneran en cada intento, así que todo `23505` es una colisión reintentable. Si algún
 * día se agrega una unique de negocio (p. ej. un solo comprobante emitido por reserva),
 * hay que acotar el reintento a esas dos columnas: si no, gastaría los 3 intentos.
 */
export async function insertReceiptWithRetry<T>(
  kind: ReceiptKind,
  insert: (ids: { receiptNumber: string; verificationCode: string }) => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
  options: { maxAttempts?: number; year?: number } = {},
): Promise<{ data: T | null; error: { code?: string } | null; receiptNumber: string; verificationCode: string; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? 3;
  let last = { data: null as T | null, error: null as { code?: string } | null, receiptNumber: "", verificationCode: "", attempts: 0 };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ids = { receiptNumber: generateReceiptNumber(kind, options.year), verificationCode: crypto.randomUUID() };
    const { data, error } = await insert(ids);
    last = { data, error, ...ids, attempts: attempt };
    if (!error || error.code !== "23505") return last;
  }
  return last;
}
