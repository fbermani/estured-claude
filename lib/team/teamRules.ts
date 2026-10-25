import type { ResidenceRole } from "@/lib/residences/permissions";

/**
 * Reglas puras del equipo de una residencia (DR10, docs/00 §31). Sin base de datos ni `server-only`: las usan el servidor y los tests.
 * Los topes son cifras de partida (supuestos reversibles, docs/00 DR10 (e)).
 */

/** Cuánto vive una invitación desde que se envía (o se reenvía). */
export const INVITATION_TTL_DAYS = 7;
/** Staff por residencia: activos + invitaciones pendientes vigentes. */
export const MAX_STAFF_PER_RESIDENCE = 10;
/** Envíos de email (invitaciones nuevas + reenvíos) por hora y por residencia. Se cuentan desde `audit_logs`, no desde filas de invitaciones. */
export const MAX_INVITATIONS_PER_HOUR = 5;
/** Espera mínima entre dos envíos de la MISMA invitación (reenvío). */
export const RESEND_COOLDOWN_MINUTES = 10;
/** Envíos totales de una misma invitación (el primero + reenvíos). Pasado el tope hay que cancelarla y crear otra. */
export const MAX_SENDS_PER_INVITATION = 5;

/**
 * Estados de residencia en los que NO se invita (ni se reenvía): sin perfil enviado o sin operar. `rejected` no es un estado técnico de
 * residencia (un rechazo de verificación deja la residencia en `suspended`, docs/04 §13.2); se lista igual por defensa en profundidad.
 */
export const INVITE_BLOCKED_RESIDENCE_STATUSES: readonly string[] = ["draft", "rejected", "suspended", "archived"];
/** Estados terminales: una invitación ya enviada deja de poder aceptarse. */
export const ACCEPT_BLOCKED_RESIDENCE_STATUSES: readonly string[] = ["rejected", "suspended", "archived"];
/** Roles globales que nunca pueden sumarse como staff por invitación (aunque la cuenta tenga además un rol de residencia). */
export const INELIGIBLE_ACCOUNT_ROLES: readonly string[] = ["admin", "superadmin", "student"];

export const STAFF_LIMIT_ERROR = `Llegaste al máximo de ${MAX_STAFF_PER_RESIDENCE} personas de staff (contando invitaciones pendientes). Cancelá una invitación o quitá un acceso para invitar a alguien más.`;

/** Al aceptar, si la residencia ya tiene el tope de staff activos (la invitación no se consume: puede reintentar cuando haya lugar). */
export const TEAM_FULL_ON_ACCEPT_MESSAGE =
  "El equipo de esta residencia ya llegó al máximo de personas. Pedile al dueño que libere un lugar y volvé a probar con este mismo enlace mientras siga vigente.";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInviteEmail(raw: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Ingresá el email de la persona que querés invitar." };
  if (email.length > 200 || !EMAIL_RE.test(email)) return { ok: false, error: "Revisá el email: no parece válido." };
  return { ok: true, email };
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type StoredInvitationStatus = "pending" | "accepted" | "cancelled";
/** Lo que ve el dueño: el vencimiento se deduce de `expires_at` (no es un estado guardado). */
export type InvitationView = "pending" | "expired" | "accepted" | "cancelled";

export function invitationView(row: { status: string; expires_at: string }, now: Date): InvitationView {
  if (row.status === "accepted") return "accepted";
  if (row.status === "cancelled") return "cancelled";
  return new Date(row.expires_at).getTime() > now.getTime() ? "pending" : "expired";
}

/** Mensaje único para un enlace inválido, vencido, usado o cancelado (no distingue cuál de los cuatro). */
export const INVALID_INVITATION_MESSAGE =
  "Este enlace no es válido o ya venció. Pedile al dueño de la residencia que te envíe una invitación nueva.";

export const TEAM_UNAVAILABLE_MESSAGE =
  "Las invitaciones por email todavía no están disponibles. Probá de nuevo más tarde o escribinos por Soporte.";

export type InviteLimitInput = {
  /** Staff activos hoy. */
  activeStaff: number;
  /** Invitaciones pendientes y vigentes (las vencidas no cuentan). */
  pendingInvitations: number;
  /** Invitaciones y reenvíos de la última hora. */
  sentLastHour: number;
};

/**
 * Topes de la residencia. `forResend` no suma un lugar nuevo (la invitación ya ocupaba uno), pero sí cuenta para el límite por hora.
 */
export function checkInviteLimits(
  input: InviteLimitInput,
  options: { forResend?: boolean } = {},
): { ok: true } | { ok: false; error: string } {
  if (input.sentLastHour >= MAX_INVITATIONS_PER_HOUR) {
    return { ok: false, error: "Enviaste muchas invitaciones en poco tiempo. Probá de nuevo en un rato." };
  }
  if (!options.forResend && input.activeStaff + input.pendingInvitations >= MAX_STAFF_PER_RESIDENCE) {
    return { ok: false, error: STAFF_LIMIT_ERROR };
  }
  return { ok: true };
}

/** Se puede invitar / reenviar solo si la residencia ya salió de borrador y no está rechazada, suspendida ni archivada. */
export function checkResidenceCanInvite(status: unknown): { ok: true } | { ok: false; error: string } {
  const value = typeof status === "string" ? status : "";
  if (value === "draft") {
    return {
      ok: false,
      error: "Todavía no podés invitar al equipo: primero completá el perfil de la residencia y enviala a verificación.",
    };
  }
  if (!value || INVITE_BLOCKED_RESIDENCE_STATUSES.includes(value)) {
    return {
      ok: false,
      error: "Esta residencia no está activa, así que no se pueden sumar personas al equipo. Escribinos por Soporte si necesitás ayuda.",
    };
  }
  return { ok: true };
}

/** `true` si la residencia está en un estado terminal en el que una invitación pendiente ya no se puede aceptar (o no se puede leer). */
export function isTerminalResidenceStatus(status: unknown): boolean {
  return typeof status !== "string" || ACCEPT_BLOCKED_RESIDENCE_STATUSES.includes(status);
}

/** Reenvío de una invitación: espera mínima desde el último envío y tope de envíos por invitación. */
export function checkResendAllowed(
  input: { lastSentAt: string | null; sendCount: number | null },
  now: Date,
): { ok: true } | { ok: false; error: string } {
  if ((input.sendCount ?? 1) >= MAX_SENDS_PER_INVITATION) {
    return { ok: false, error: "Esa invitación ya se envió muchas veces. Cancelala y creá una nueva si hace falta." };
  }
  const last = input.lastSentAt ? new Date(input.lastSentAt).getTime() : NaN;
  if (Number.isFinite(last) && now.getTime() - last < RESEND_COOLDOWN_MINUTES * 60 * 1000) {
    return { ok: false, error: `Esperá unos minutos antes de reenviar esa invitación (mínimo ${RESEND_COOLDOWN_MINUTES} minutos entre envíos).` };
  }
  return { ok: true };
}

/**
 * Elegibilidad de la cuenta que acepta: activa, no bloqueada, con rol de residencia (dueño o staff) y SIN rol de admin, superadmin ni
 * estudiante. Un familiar que además es dueño de una residencia sí puede aceptar.
 */
export function isEligibleStaffAccount(input: {
  isActive: boolean | null | undefined;
  isBlocked: boolean | null | undefined;
  roles: readonly string[];
}): boolean {
  if (input.isActive !== true || input.isBlocked) return false;
  if (input.roles.some((r) => INELIGIBLE_ACCOUNT_ROLES.includes(r))) return false;
  return input.roles.some((r) => r === "residence_staff" || r === "residence_owner");
}

export type RemoveMemberInput = {
  actorUserId: string;
  actorRole: ResidenceRole | null;
  target: { userId: string; role: ResidenceRole; isActive: boolean } | null;
  /** Dueños activos de la residencia (contando al objetivo si lo es). */
  activeOwnerCount: number;
};

/**
 * Quitar acceso (DR10): solo el dueño, solo a un staff activo. El dueño no puede quitarse a sí mismo y la residencia nunca queda sin
 * dueño: a un `owner` no se le quita el acceso desde esta pantalla (ni a otro dueño ni a uno mismo).
 */
export function canRemoveMember(input: RemoveMemberInput): { allowed: true } | { allowed: false; error: string } {
  if (input.actorRole !== "owner") {
    return { allowed: false, error: "Esta acción la puede hacer solo el dueño de la residencia." };
  }
  if (!input.target) return { allowed: false, error: "No encontramos a esa persona en el equipo." };
  if (input.target.userId === input.actorUserId) {
    return { allowed: false, error: "No podés quitarte el acceso a vos mismo." };
  }
  if (!input.target.isActive) return { allowed: false, error: "Esa persona ya no tiene acceso a la residencia." };
  if (input.target.role === "owner") {
    return {
      allowed: false,
      error:
        input.activeOwnerCount <= 1
          ? "La residencia tiene que conservar al menos un dueño."
          : "No se le puede quitar el acceso a un dueño desde acá. Escribinos por Soporte si necesitás hacerlo.",
    };
  }
  return { allowed: true };
}
