import { createHash, randomBytes } from "node:crypto";

/**
 * Token de invitación al equipo (DR10): 32 bytes aleatorios en base64url (43 caracteres). Solo se guarda su SHA-256 (hex); el token en
 * claro viaja únicamente en el enlace del email. La búsqueda es por IGUALDAD del hash en la base (índice único de `token_hash`), no una
 * comparación en el código: con un token aleatorio de 256 bits no hay nada que adivinar ni un secreto que filtrar por tiempos de respuesta. Un solo uso y con vencimiento (ver `teamRules` y la tabla `residence_team_invitations`).
 */
export const INVITATION_TOKEN_LENGTH = 43;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

/** Forma válida del token (descarta basura antes de ir a la base). No dice nada sobre si existe. */
export function isPlausibleInvitationToken(token: unknown): token is string {
  return typeof token === "string" && token.length === INVITATION_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token);
}
