import "server-only";
import { createHash } from "node:crypto";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/receipts/verifyRateLimit";

/**
 * Frenos de los pasos públicos de la invitación personal (DR19): en memoria y por instancia (best-effort en serverless, igual que
 * `verifyRateLimit` y el aceptar-invitación del equipo); el límite real va en el WAF de Vercel. Las claves son hashes (IP y token).
 */
const byClient = createRateLimiter({ limit: 30, windowMs: 3_600_000 });
const byToken = createRateLimiter({ limit: 20, windowMs: 3_600_000 });
const codeRequestsByToken = createRateLimiter({ limit: 6, windowMs: 3_600_000 });

export const INVITE_TOO_MANY_ATTEMPTS = "Hiciste muchos intentos. Probá de nuevo en un rato.";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export function inviteAttemptAllowed(headers: { get(name: string): string | null }, token: string): boolean {
  return byClient(sha(clientKeyFromHeaders(headers))) && byToken(sha(String(token)));
}

/** Pedidos de código al mail por enlace: tope bajo para que nadie use la pantalla para llenar un buzón. */
export function inviteCodeRequestAllowed(token: string): boolean {
  return codeRequestsByToken(sha(String(token)));
}

const residencyByUser = createRateLimiter({ limit: 12, windowMs: 3_600_000 });
/** Pedidos de código / intentos del estudiante con sesión desde «Mi residencia». */
export function residencyStepAllowed(userId: string): boolean {
  return residencyByUser(sha(userId));
}
