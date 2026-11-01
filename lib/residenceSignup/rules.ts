import { BARRIO_OPTIONS } from "@/lib/residences/options";

/**
 * Solicitud de alta de residencia (DR22 D/E1–E7, migración 0066). Reglas puras (sin base ni `server-only`) para poder testearlas.
 * Los estados son PROPIOS de la solicitud: no son los de `residences` (docs/04 §4) ni los del ciclo de verificación DR7.
 */

export const SIGNUP_STATUSES = ["received", "in_contact", "visit_scheduled", "account_delivered", "discarded"] as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

export const SIGNUP_STATUS_LABEL: Record<SignupStatus, string> = {
  received: "Recibida",
  in_contact: "En contacto",
  visit_scheduled: "Visita coordinada",
  account_delivered: "Cuenta entregada",
  discarded: "Descartada",
};

/**
 * Transiciones que el admin puede hacer a mano. `account_delivered` NO está: solo la alcanza el canje del enlace (la cuenta existe
 * recién cuando la residencia crea su contraseña). `discarded` es terminal; `account_delivered` también.
 */
const MANUAL_TRANSITIONS: Record<SignupStatus, readonly SignupStatus[]> = {
  received: ["in_contact", "discarded"],
  in_contact: ["visit_scheduled", "discarded"],
  visit_scheduled: ["discarded"],
  account_delivered: [],
  discarded: [],
};

export function isSignupStatus(value: unknown): value is SignupStatus {
  return typeof value === "string" && (SIGNUP_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: SignupStatus, to: SignupStatus): boolean {
  return MANUAL_TRANSITIONS[from].includes(to);
}

/** Solicitudes «activas» (las que entran en la cola de trabajo y en el índice anti-duplicados). */
export function isActiveStatus(status: SignupStatus): boolean {
  return status !== "account_delivered" && status !== "discarded";
}

/** La invitación solo se genera con la visita coordinada, el email confirmado por el admin y mientras no se haya usado. */
export function canGenerateInvite(status: SignupStatus, inviteUsedAt: string | null, emailConfirmedAt: string | null): boolean {
  return status === "visit_scheduled" && !inviteUsedAt && !!emailConfirmedAt;
}

// ---- Invitación de un solo uso (E3) ----

export const INVITE_TTL_DAYS = 7;

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InviteRow = {
  status: SignupStatus;
  invite_expires_at: string | null;
  invite_used_at: string | null;
};

export type InviteState = "valid" | "used" | "expired" | "invalid";

/** Estado del enlace según la fila encontrada por hash (`null` = no existe). */
export function inviteState(row: InviteRow | null, now: Date = new Date()): InviteState {
  if (!row) return "invalid";
  if (row.invite_used_at || row.status === "account_delivered") return "used";
  if (row.status !== "visit_scheduled") return "invalid";
  if (!row.invite_expires_at || new Date(row.invite_expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const INVITE_MESSAGES: Record<Exclude<InviteState, "valid">, string> = {
  invalid: "Este enlace no es válido. Revisá que lo hayas copiado completo o pedile uno nuevo al equipo de EstuRed.",
  used: "Este enlace ya se usó. Si ya creaste tu cuenta, ingresá desde «Iniciar sesión»; si no fuiste vos, escribinos.",
  expired: "Este enlace venció. Pedile uno nuevo al equipo de EstuRed.",
};

// ---- Validación del formulario público (E1) ----

export type SignupInput = {
  residence_name: string;
  neighborhood: string;
  contact_name: string;
  email: string;
  phone: string;
  instagram_or_web: string | null;
  approx_beds: number | null;
};

export type SignupValidation =
  | { ok: true; value: SignupInput }
  | { ok: false; field: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BARRIOS = new Set<string>(BARRIO_OPTIONS);

/** Mismos límites que los checks de la tabla (`0066`). */
export function validateSignupForm(raw: Record<string, string>): SignupValidation {
  const residence_name = (raw.residence_name ?? "").trim();
  const neighborhood = (raw.neighborhood ?? "").trim();
  const contact_name = (raw.contact_name ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const phone = (raw.phone ?? "").trim();
  const social = (raw.instagram_or_web ?? "").trim();
  const bedsRaw = (raw.approx_beds ?? "").trim();

  if (residence_name.length < 2 || residence_name.length > 120)
    return { ok: false, field: "residence_name", message: "Contanos el nombre de la residencia." };
  if (!BARRIOS.has(neighborhood)) return { ok: false, field: "neighborhood", message: "Elegí el barrio donde está la residencia." };
  if (contact_name.length < 2 || contact_name.length > 120)
    return { ok: false, field: "contact_name", message: "Contanos el nombre del responsable." };
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, field: "email", message: "Revisá el email: no parece válido." };
  if (!/^[+0-9()\-\s]{5,40}$/.test(phone) || phone.replace(/\D/g, "").length < 6)
    return { ok: false, field: "phone", message: "Revisá el teléfono: usá números, espacios o «+»." };
  if (social.length > 200) return { ok: false, field: "instagram_or_web", message: "El Instagram o la web es demasiado largo (hasta 200 caracteres)." };
  let approx_beds: number | null = null;
  if (bedsRaw) {
    const n = Number(bedsRaw);
    if (!Number.isInteger(n) || n < 1 || n > 2000) return { ok: false, field: "approx_beds", message: "Las camas tienen que ser un número entero, por ejemplo 12." };
    approx_beds = n;
  }
  return { ok: true, value: { residence_name, neighborhood, contact_name, email, phone, instagram_or_web: social || null, approx_beds } };
}
