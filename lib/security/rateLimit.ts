import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Rate limit persistente en Postgres (auditoría 2026-11-11, M6; migración 0083). A diferencia de los frenos en memoria
 * (`createRateLimiter`), cuenta los intentos entre todas las instancias serverless.
 *
 * La clave (IP, email, id de usuario) se guarda SOLO como SHA-256: nunca en claro. La RPC `consume_rate_limit` es atómica por
 * clave y solo la puede ejecutar el service role.
 *
 * Si no hay cliente admin o la RPC falla (p. ej. la 0083 todavía no está aplicada): fuera de producción deja pasar (fail-open) y
 * en producción corta (fail-closed); en ambos casos lo loguea con `console.error`, sin la clave ni datos personales.
 */
export type RateLimitOptions = {
  /** Nombre corto y estable del límite (p. ej. `login_ip`). Separa contadores de claves iguales. */
  bucket: string;
  /** Valor a limitar (IP, email normalizado, id). Se hashea antes de salir del proceso. */
  key: string;
  windowSeconds: number;
  max: number;
};

export type RateLimitResult = { ok: boolean };

export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function failureResult(bucket: string, reason: string): RateLimitResult {
  console.error(`[rate-limit] ${bucket}: ${reason}`);
  return { ok: process.env.NODE_ENV !== "production" };
}

/**
 * Registra un intento y dice si quedó dentro del límite (`max` intentos por `windowSeconds`). Los intentos rechazados no se
 * registran. `client` es inyectable para tests; por defecto, el cliente admin.
 */
export async function consumeRateLimit(
  options: RateLimitOptions,
  client: SupabaseClient | null = getSupabaseAdmin(),
): Promise<RateLimitResult> {
  const { bucket, key, windowSeconds, max } = options;
  if (!client) return failureResult(bucket, "sin cliente admin");
  try {
    const { data, error } = await client.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_key_hash: hashRateLimitKey(key),
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) return failureResult(bucket, `rpc falló (${error.code ?? "sin código"})`);
    if (typeof data !== "boolean") return failureResult(bucket, "respuesta inesperada de la rpc");
    return { ok: data };
  } catch {
    return failureResult(bucket, "excepción al llamar la rpc");
  }
}

/**
 * Consulta sin registrar (RPC `peek_rate_limit`, migración 0086): `true` si la clave ya alcanzó el límite. Mismo criterio de
 * fallo que `consumeRateLimit` (fuera de producción deja pasar; en producción corta).
 */
export async function isRateLimited(
  options: RateLimitOptions,
  client: SupabaseClient | null = getSupabaseAdmin(),
): Promise<boolean> {
  const { bucket, key, windowSeconds, max } = options;
  if (!client) return !failureResult(bucket, "sin cliente admin").ok;
  try {
    const { data, error } = await client.rpc("peek_rate_limit", {
      p_bucket: bucket,
      p_key_hash: hashRateLimitKey(key),
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) return !failureResult(bucket, `peek falló (${error.code ?? "sin código"})`).ok;
    if (typeof data !== "boolean") return !failureResult(bucket, "respuesta inesperada de peek").ok;
    return !data;
  } catch {
    return !failureResult(bucket, "excepción al llamar peek").ok;
  }
}

/** Normaliza un email para usarlo como clave (mismo email con mayúsculas/espacios = misma clave). */
export function emailRateLimitKey(email: string): string {
  return email.trim().toLowerCase();
}
