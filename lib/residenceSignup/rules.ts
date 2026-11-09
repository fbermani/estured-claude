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

// ---- Validación del formulario público (E1, DR46.4) ----

/** Los 5 datos OBLIGATORIOS del formulario (DR46.4: la dirección reemplaza al barrio). Instagram y camas son opcionales y solo los pide la versión sin preapertura. */
export const SIGNUP_REQUIRED_FIELDS = ["residence_name", "address", "contact_name", "phone", "email"] as const;
export type SignupRequiredField = (typeof SIGNUP_REQUIRED_FIELDS)[number];

export const SIGNUP_ALERT_EMPTY = "Completá los 5 datos para que te contactemos.";
export const SIGNUP_ALERT_INVALID = "Revisá los datos marcados.";

export type SignupInput = {
  residence_name: string;
  address: string;
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

export type SignupFieldsResult = {
  /** name del campo -> mensaje (en español, accionable). Vacío si todo está bien. */
  errors: Record<string, string>;
  /** Alguno de los 5 obligatorios llegó vacío (decide qué alerta general se muestra). */
  anyRequiredEmpty: boolean;
  value: SignupInput | null;
};

/**
 * Valida TODOS los campos a la vez (el cliente marca cada uno con `aria-invalid`; el servidor repite la misma regla, que es la que cuenta).
 * Mismos límites que los checks de la tabla (`0066`/`0080`): nombre 2–120, dirección 5–200, responsable 2–120.
 */
export function validateSignupFields(raw: Record<string, string>): SignupFieldsResult {
  const residence_name = (raw.residence_name ?? "").trim();
  const address = (raw.address ?? "").trim();
  const contact_name = (raw.contact_name ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const phone = (raw.phone ?? "").trim();
  const social = (raw.instagram_or_web ?? "").trim();
  const bedsRaw = (raw.approx_beds ?? "").trim();

  const errors: Record<string, string> = {};
  if (residence_name.length < 2 || residence_name.length > 120) errors.residence_name = "Escribí el nombre de la residencia.";
  if (address.length < 5 || address.length > 200 || !/\p{L}/u.test(address)) errors.address = "Escribí la dirección, con calle y número.";
  if (contact_name.length < 2 || contact_name.length > 120) errors.contact_name = "Escribí tu nombre.";
  if (!/^[+0-9()\-\s]{5,40}$/.test(phone) || phone.replace(/\D/g, "").length < 6) errors.phone = "Escribí un teléfono con código de área.";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Escribí un email completo, por ejemplo nombre@gmail.com.";
  if (social.length > 200) errors.instagram_or_web = "El Instagram o la web es demasiado largo (hasta 200 caracteres).";
  let approx_beds: number | null = null;
  if (bedsRaw) {
    const n = Number(bedsRaw);
    if (!Number.isInteger(n) || n < 1 || n > 2000) errors.approx_beds = "Las camas tienen que ser un número entero, por ejemplo 12.";
    else approx_beds = n;
  }

  const anyRequiredEmpty = SIGNUP_REQUIRED_FIELDS.some((f) => ({ residence_name, address, contact_name, phone, email })[f] === "");
  const ok = Object.keys(errors).length === 0;
  return {
    errors,
    anyRequiredEmpty,
    value: ok ? { residence_name, address, contact_name, email, phone, instagram_or_web: social || null, approx_beds } : null,
  };
}

/** Variante «primer error» (compatibilidad con los usos y tests previos). */
export function validateSignupForm(raw: Record<string, string>): SignupValidation {
  const result = validateSignupFields(raw);
  if (result.value) return { ok: true, value: result.value };
  const [field, message] = Object.entries(result.errors)[0];
  return { ok: false, field, message };
}
