import "server-only";
import { clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { consumeRateLimit } from "@/lib/security/rateLimit";

/**
 * Frenos de los pasos públicos de la invitación personal (DR19). Persistentes en Postgres vía `consumeRateLimit` (migración 0083):
 * cuentan entre todas las instancias serverless (auditoría de costos 2026-11-21, C3; antes eran en memoria y por instancia). Las
 * claves (IP, token, usuario) se hashean dentro de `consumeRateLimit`, nunca se guardan en claro.
 */
const HOUR = 3_600;

export const INVITE_TOO_MANY_ATTEMPTS = "Hiciste muchos intentos. Probá de nuevo en un rato.";

export async function inviteAttemptAllowed(headers: { get(name: string): string | null }, token: string): Promise<boolean> {
  const byClient = await consumeRateLimit({ bucket: "invite_client", key: clientKeyFromHeaders(headers), windowSeconds: HOUR, max: 30 });
  if (!byClient.ok) return false;
  return (await consumeRateLimit({ bucket: "invite_token", key: String(token), windowSeconds: HOUR, max: 20 })).ok;
}

/** Pedidos de código al mail por enlace: tope bajo para que nadie use la pantalla para llenar un buzón. */
export async function inviteCodeRequestAllowed(token: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "invite_code_token", key: String(token), windowSeconds: HOUR, max: 6 })).ok;
}

/** Pedidos de código / intentos del estudiante con sesión desde «Mi residencia». */
export async function residencyStepAllowed(userId: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "residency_user", key: userId, windowSeconds: HOUR, max: 12 })).ok;
}
