import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Reglas puras de la invitación personal a un residente y del código al mail (DR19). Sin base de datos: se testean solos.
 * El token del enlace usa `lib/team/invitationToken.ts` (mismo patrón: solo se guarda el SHA-256).
 */

import { INVITE_TTL_DAYS, OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/residents/inviteConstants";
export { INVITE_TTL_DAYS, OTP_LENGTH, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS, OTP_MAX_TOTAL_ATTEMPTS, OTP_MAX_SENDS, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/residents/inviteConstants";

export type InviteChannel = "email" | "whatsapp" | "manual";

export type InviteRow = {
  channel: InviteChannel;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  declined_at: string | null;
  otp_hash: string | null;
  otp_expires_at: string | null;
  otp_sent_at: string | null;
  otp_attempts: number;
  otp_verified_at: string | null;
};

export type InviteState = "open" | "used" | "declined" | "revoked" | "expired";

export function inviteExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Estado de una invitación. «Rechazada» (el estudiante dijo que no es él/ella) gana sobre «revocada». */
export function evaluateInvite(row: Pick<InviteRow, "expires_at" | "used_at" | "revoked_at" | "declined_at">, now: Date = new Date()): InviteState {
  if (row.used_at) return "used";
  if (row.declined_at) return "declined";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "open";
}

export const INVITE_STATE_MESSAGES: Record<Exclude<InviteState, "open">, string> = {
  used: "Este enlace ya se usó. Si ya activaste tu estadía, ingresá con tu cuenta; si no, pedile a tu residencia que te mande uno nuevo.",
  declined: "Este enlace ya no sirve. Pedile a tu residencia que lo revise y te mande uno nuevo.",
  revoked: "Este enlace ya no sirve porque la residencia mandó uno más nuevo (o corrigió tus datos). Revisá tu mail o WhatsApp, o pedile uno nuevo.",
  expired: `Este enlace venció (valen ${INVITE_TTL_DAYS} días). Pedile a tu residencia que te mande uno nuevo.`,
};
/** Mensaje único para un token inexistente o mal formado: no distingue «no existe» de nada más. */
export const INVITE_NOT_FOUND_MESSAGE = "Este enlace no es válido. Pedile a tu residencia que te mande uno nuevo.";

/** Código numérico de 6 dígitos con CSPRNG (`randomInt`), con ceros a la izquierda. */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** El código se ata a la invitación (sal = id) para que un hash robado no valga para otra. */
export function hashOtp(code: string, invitationId: string): string {
  return createHash("sha256").update(`${invitationId}:${code}`, "utf8").digest("hex");
}

export function isPlausibleOtp(code: unknown): code is string {
  return typeof code === "string" && new RegExp(`^[0-9]{${OTP_LENGTH}}$`).test(code);
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "wrong"; attemptsLeft: number };

/** Compara un código. No muta nada ni cuenta intentos: los topes (por código y acumulado) los aplica la base, de forma atómica, ANTES de llamar a esto. */
export function checkOtp(row: Pick<InviteRow, "otp_hash" | "otp_expires_at" | "otp_attempts">, code: string, invitationId: string, now: Date = new Date()): OtpCheck {
  if (!row.otp_hash || !row.otp_expires_at) return { ok: false, reason: "no_code", attemptsLeft: 0 };
  if (new Date(row.otp_expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expired", attemptsLeft: 0 };
  const expected = Buffer.from(row.otp_hash, "hex");
  const given = Buffer.from(hashOtp(code, invitationId), "hex");
  const equal = expected.length === given.length && timingSafeEqual(expected, given);
  if (equal) return { ok: true };
  return { ok: false, reason: "wrong", attemptsLeft: 0 };
}

/** Segundos que faltan para poder pedir otro código (0 = ya se puede). */
export function otpCooldownRemaining(row: Pick<InviteRow, "otp_sent_at">, now: Date = new Date()): number {
  if (!row.otp_sent_at) return 0;
  const elapsed = (now.getTime() - new Date(row.otp_sent_at).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

export const OTP_MESSAGES = {
  no_code: "Pedí un código nuevo: todavía no te mandamos ninguno.",
  expired: "El código venció. Pedí uno nuevo.",
  locked: "Probaste demasiadas veces con este código. Pedí uno nuevo.",
  lockedTotal: "Superaste el máximo de intentos de esta invitación. Pedile a tu residencia que te mande una nueva.",
  tooManySends: "Ya pedimos demasiados códigos para esta invitación. Pedile a tu residencia que te mande una nueva.",
  wrong: (left: number) => `Ese código no coincide. Te quedan ${left} ${left === 1 ? "intento" : "intentos"}.`,
  cooldown: (s: number) => `Esperá ${s} segundos antes de pedir otro código.`,
  sent: "Te mandamos un código al mail. Puede tardar un minuto; revisá también spam.",
  mailFailed: "No pudimos enviar el código. Probá de nuevo en unos minutos.",
};

/** `ana.perez@gmail.com` → `a•••@gmail.com`. Para mostrar a quien tiene el enlace sin exponer el mail completo. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** Nombre del remitente del mail de invitación: sin caracteres que rompan el encabezado `From` y acotado. */
export function inviteSenderName(residenceName: string): string {
  const clean = residenceName.replace(/[<>"\r\n,;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${clean || "Tu residencia"} te invita, vía EstuRed`;
}

/** El contacto de la residencia sirve de `reply-to` solo si es un mail válido (si es un teléfono, no). */
export function replyToFromContact(contact: string | null | undefined): string | null {
  const value = (contact ?? "").trim().toLowerCase();
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value) && value.length <= 254 ? value : null;
}
