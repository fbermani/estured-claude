import "server-only";
import { clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { consumeRateLimit, emailRateLimitKey } from "@/lib/security/rateLimit";

/**
 * Frenos del registro de preapertura (M6): persistentes en Postgres vía `consumeRateLimit` (migración 0083), así cuentan entre
 * todas las instancias serverless. Las claves se hashean antes de guardarse (IP, email, usuario), nunca en texto plano.
 */
export const PREAPERTURA_TOO_MANY_ATTEMPTS = "Hiciste muchos intentos. Probá de nuevo en un rato.";

const HOUR = 3_600;
const DAY = 86_400;

/** Intentos de crear cuenta (estudiante o familiar): 15 por hora por IP y 6 por hora por email. */
export async function signupAllowed(headers: { get(name: string): string | null }, email: string): Promise<boolean> {
  const byClient = await consumeRateLimit({ bucket: "preap_signup_ip", key: clientKeyFromHeaders(headers), windowSeconds: HOUR, max: 15 });
  if (!byClient.ok) return false;
  const byEmail = await consumeRateLimit({ bucket: "preap_signup_email", key: emailRateLimitKey(email), windowSeconds: HOUR, max: 6 });
  return byEmail.ok;
}

/** Guardados del perfil del paso 2: 60 por hora por usuario con sesión. */
export async function profileSaveAllowed(userId: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "preap_profile_user", key: userId, windowSeconds: HOUR, max: 60 })).ok;
}

/** Mails de invitación familiar a un mismo destinatario: 3 por día (evita usar el formulario para llenar el buzón de un tercero). */
export async function familyInviteMailAllowed(inviteeEmail: string): Promise<boolean> {
  return (await consumeRateLimit({ bucket: "preap_invite_mail_to", key: emailRateLimitKey(inviteeEmail), windowSeconds: DAY, max: 3 })).ok;
}
