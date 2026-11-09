import "server-only";
import { createHash } from "node:crypto";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/receipts/verifyRateLimit";

/**
 * Frenos del registro de preapertura. En memoria y por instancia (best-effort en serverless, igual que `verifyRateLimit` y el
 * resto de los pasos públicos): encarece el abuso pero NO es el control de producción; el límite real va en el WAF de Vercel sobre
 * `/preregistro`. Las claves son hashes (IP, email, usuario), nunca texto plano.
 */
const signupByClient = createRateLimiter({ limit: 15, windowMs: 3_600_000 });
const signupByEmail = createRateLimiter({ limit: 6, windowMs: 3_600_000 });
const profileByUser = createRateLimiter({ limit: 60, windowMs: 3_600_000 });

export const PREAPERTURA_TOO_MANY_ATTEMPTS = "Hiciste muchos intentos. Probá de nuevo en un rato.";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** Intentos de crear cuenta (estudiante o familiar) por IP y por email. */
export function signupAllowed(headers: { get(name: string): string | null }, email: string): boolean {
  return signupByClient(sha(clientKeyFromHeaders(headers))) && signupByEmail(sha(email));
}

/** Guardados del perfil del paso 2 por usuario con sesión. */
export function profileSaveAllowed(userId: string): boolean {
  return profileByUser(sha(userId));
}
