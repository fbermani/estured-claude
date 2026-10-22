import "server-only";
import { createRateLimiter } from "@/lib/receipts/verifyRateLimit";

/**
 * Frenos del pedido de recuperación de contraseña (H13). En memoria y por
 * instancia (best-effort en serverless, igual que `verifyRateLimit`): encarece
 * el abuso pero NO es el control de producción. **El límite real va en el WAF
 * / Firewall de Vercel sobre `/forgot-password`** (pendiente, anotado en
 * MEMORY.md Ciclo 50). Las claves son hashes (IP y email), nunca texto plano.
 */
export const resetByIpAllowed = createRateLimiter({ limit: 5, windowMs: 3_600_000 });
export const resetByEmailAllowed = createRateLimiter({ limit: 3, windowMs: 3_600_000 });

/** Piso de tiempo de respuesta: iguala cuentas normales con bloqueadas/limitadas. */
export const MIN_RESET_RESPONSE_MS = 1500;

/** Espera lo que falte para completar `minMs` desde `startedAt`. */
export async function padToMinimum(startedAt: number, minMs: number = MIN_RESET_RESPONSE_MS) {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
