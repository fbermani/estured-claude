import "server-only";
import { consumeRateLimit, emailRateLimitKey } from "@/lib/security/rateLimit";

/**
 * Frenos del pedido de recuperación de contraseña (H13, M6): persistentes en Postgres vía `consumeRateLimit` (migración 0083),
 * así cuentan entre todas las instancias serverless. Las claves (IP y email) se hashean antes de guardarse, nunca en texto plano.
 */
const HOUR = 3_600;

/** 5 pedidos por hora por IP (clave de `clientKeyFromHeaders`). */
export async function resetByIpAllowed(clientKey: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "reset_ip", key: clientKey, windowSeconds: HOUR, max: 5 })).ok;
}

/** 3 pedidos por hora por email. */
export async function resetByEmailAllowed(email: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "reset_email", key: emailRateLimitKey(email), windowSeconds: HOUR, max: 3 })).ok;
}

/** Piso de tiempo de respuesta: iguala cuentas normales con bloqueadas/limitadas. */
export const MIN_RESET_RESPONSE_MS = 1500;

/** Espera lo que falte para completar `minMs` desde `startedAt`. */
export async function padToMinimum(startedAt: number, minMs: number = MIN_RESET_RESPONSE_MS) {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
