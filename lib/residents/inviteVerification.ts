import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sendEmail";
import { hashInvitationToken, isPlausibleInvitationToken } from "@/lib/team/invitationToken";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { buildOtpEmail } from "@/lib/residents/inviteMessage";
import {
  checkOtp,
  evaluateInvite,
  generateOtpCode,
  hashOtp,
  INVITE_NOT_FOUND_MESSAGE,
  INVITE_STATE_MESSAGES,
  inviteExpiry,
  isPlausibleOtp,
  maskEmail,
  OTP_MESSAGES,
  OTP_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_TOTAL_ATTEMPTS,
  OTP_MAX_SENDS,
  otpCooldownRemaining,
  type InviteChannel,
  type InviteRow,
} from "@/lib/residents/inviteRules";

/**
 * Lado estudiante / público de la invitación personal (DR19): leer un enlace, responder «no soy yo» y verificar el mail con un código
 * (OTP). Todo con service role, validando en el servidor; los mensajes no confirman si un mail tiene cuenta. Los frenos por IP y por
 * token viven en las server actions que llaman a estas funciones.
 */

export type InviteFull = InviteRow & {
  id: string;
  resident_stay_id: string;
  residence_id: string;
  otp_email: string | null;
};
type StayLite = {
  id: string;
  invite_email: string | null;
  invite_name: string | null;
  student_profile_id: string | null;
  is_current: boolean;
  status: string;
  residence_id: string;
};

const INVITE_COLS =
  "id, resident_stay_id, residence_id, channel, expires_at, used_at, revoked_at, declined_at, otp_hash, otp_expires_at, otp_sent_at, otp_attempts, otp_code_attempts, otp_send_count, otp_verified_at, otp_email";
const STAY_COLS = "id, invite_email, invite_name, student_profile_id, is_current, status, residence_id";
const GENERIC = "No pudimos completar el paso. Intentá de nuevo en unos minutos.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ¿Hace falta verificar el mail con un código? Sí si el enlace llegó por WhatsApp o si la residencia no cargó el mail. */
export function otpRequiredFor(channel: InviteChannel, stayHasEmail: boolean): boolean {
  return channel !== "email" || !stayHasEmail;
}

export type ResolvedInvite =
  | { ok: true; invite: InviteFull; stay: StayLite }
  | { ok: false; message: string };

export async function resolveInviteByToken(admin: SupabaseClient, rawToken: unknown, now: Date = new Date()): Promise<ResolvedInvite> {
  if (!isPlausibleInvitationToken(rawToken)) return { ok: false, message: INVITE_NOT_FOUND_MESSAGE };
  const { data: invite, error } = await admin
    .from("resident_stay_invitations")
    .select(INVITE_COLS)
    .eq("token_hash", hashInvitationToken(rawToken))
    .maybeSingle();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[residents] resolveInviteByToken failed:", error);
    return { ok: false, message: INVITE_NOT_FOUND_MESSAGE };
  }
  if (!invite) return { ok: false, message: INVITE_NOT_FOUND_MESSAGE };
  const state = evaluateInvite(invite as InviteRow, now);
  if (state !== "open") return { ok: false, message: INVITE_STATE_MESSAGES[state] };
  const { data: stay } = await admin.from("resident_stays").select(STAY_COLS).eq("id", (invite as InviteFull).resident_stay_id).maybeSingle();
  if (!stay) return { ok: false, message: INVITE_NOT_FOUND_MESSAGE };
  const s = stay as StayLite;
  if (!s.is_current || s.student_profile_id) return { ok: false, message: INVITE_STATE_MESSAGES.used };
  return { ok: true, invite: invite as InviteFull, stay: s };
}

export type PeekInviteResult =
  | {
      ok: true;
      residenceName: string;
      firstName: string | null;
      channel: InviteChannel;
      /** Mail de la residencia, enmascarado. `null` si la residencia no cargó mail (la persona usa el suyo, verificado con código). */
      maskedEmail: string | null;
      otpRequired: boolean;
      otpVerified: boolean;
      verifiedMaskedEmail: string | null;
    }
  | { ok: false; message: string };

/** Lo único que ve quien abre el enlace: nombre de la residencia, nombre de pila y el mail enmascarado. */
export async function peekResidentInvitation(admin: SupabaseClient, rawToken: unknown): Promise<PeekInviteResult> {
  const resolved = await resolveInviteByToken(admin, rawToken);
  if (!resolved.ok) return resolved;
  const { invite, stay } = resolved;
  const { data: residence } = await admin.from("residences").select("name").eq("id", stay.residence_id).maybeSingle();
  const otpRequired = otpRequiredFor(invite.channel, !!stay.invite_email);
  return {
    ok: true,
    residenceName: ((residence as { name?: string } | null)?.name ?? "Tu residencia").toString(),
    firstName: String(stay.invite_name ?? "").trim().split(" ")[0] || null,
    channel: invite.channel,
    maskedEmail: stay.invite_email ? maskEmail(stay.invite_email) : null,
    otpRequired,
    otpVerified: !!invite.otp_verified_at,
    verifiedMaskedEmail: invite.otp_verified_at && invite.otp_email ? maskEmail(invite.otp_email) : null,
  };
}

/** «No vivo ahí / no soy yo»: revoca la invitación y deja constancia para la residencia. No requiere sesión (el token es la prueba). */
export async function declineResidentInvitation(
  admin: SupabaseClient,
  params: { rawToken: unknown; ipAddress?: string | null; userAgent?: string | null; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const resolved = await resolveInviteByToken(admin, params.rawToken, now);
  if (!resolved.ok) return { ok: false, error: resolved.message };
  const { invite, stay } = resolved;
  const { error } = await admin
    .from("resident_stay_invitations")
    .update({ declined_at: now.toISOString(), revoked_at: now.toISOString(), revoke_reason: "declined" })
    .eq("id", invite.id)
    .is("used_at", null);
  if (error) {
    console.error("[residents] declineResidentInvitation failed:", error);
    return { ok: false, error: GENERIC };
  }
  await createAuditLog(admin, {
    actorUserId: null,
    actorRole: "student",
    action: "resident_invite_declined",
    entityType: "resident_stays",
    entityId: stay.id,
    newValue: { residence_id: stay.residence_id },
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
  return { ok: true };
}

async function sendOtp(admin: SupabaseClient, invite: InviteFull, email: string, now: Date): Promise<{ ok: true } | { ok: false; error: string }> {
  const wait = otpCooldownRemaining(invite, now);
  if (wait > 0) return { ok: false, error: OTP_MESSAGES.cooldown(wait) };

  // Tope de códigos por invitación, persistido y atómico (no depende de la memoria de la instancia).
  const slot = await admin.rpc("register_invite_otp_send", { p_invitation_id: invite.id, p_max_sends: OTP_MAX_SENDS });
  if (slot.error) {
    console.error("[residents] register_invite_otp_send failed:", slot.error.code);
    return { ok: false, error: GENERIC };
  }
  if (slot.data !== true) return { ok: false, error: OTP_MESSAGES.tooManySends };

  const code = generateOtpCode();
  // `otp_attempts` (acumulado) NO se resetea al reenviar: solo el contador del código vigente.
  const { error } = await admin
    .from("resident_stay_invitations")
    .update({
      otp_hash: hashOtp(code, invite.id),
      otp_expires_at: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
      otp_sent_at: now.toISOString(),
      otp_code_attempts: 0,
      otp_verified_at: null,
      otp_email: email,
    })
    .eq("id", invite.id)
    .is("used_at", null)
    .is("revoked_at", null);
  if (error) {
    console.error("[residents] sendOtp update failed:", error);
    return { ok: false, error: GENERIC };
  }
  const mail = buildOtpEmail(code);
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (!sent) {
    // Si el mail no salió, el pedido no cuenta para la espera entre envíos.
    await admin.from("resident_stay_invitations").update({ otp_sent_at: invite.otp_sent_at }).eq("id", invite.id).is("revoked_at", null);
    return { ok: false, error: OTP_MESSAGES.mailFailed };
  }
  return { ok: true };
}

async function verifyOtp(
  admin: SupabaseClient,
  invite: InviteFull,
  code: unknown,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPlausibleOtp(code)) return { ok: false, error: "Ingresá el código de 6 números que te mandamos." };

  // El intento se cuenta en SQL, de forma atómica, ANTES de comparar: N intentos en paralelo no pueden pasar el tope.
  const attempt = await admin.rpc("consume_invite_otp_attempt", {
    p_invitation_id: invite.id,
    p_max_code: OTP_MAX_ATTEMPTS,
    p_max_total: OTP_MAX_TOTAL_ATTEMPTS,
  });
  if (attempt.error) {
    console.error("[residents] consume_invite_otp_attempt failed:", attempt.error.code);
    return { ok: false, error: GENERIC };
  }
  const left = Number(attempt.data);
  if (!Number.isFinite(left) || left < 0) {
    return { ok: false, error: invite.otp_attempts + 1 >= OTP_MAX_TOTAL_ATTEMPTS ? OTP_MESSAGES.lockedTotal : OTP_MESSAGES.locked };
  }

  const check = checkOtp(invite, code, invite.id, now);
  if (check.ok) {
    const { error } = await admin
      .from("resident_stay_invitations")
      .update({ otp_verified_at: now.toISOString(), otp_hash: null, otp_expires_at: null })
      .eq("id", invite.id)
      .is("used_at", null)
      .is("revoked_at", null);
    if (error) {
      console.error("[residents] verifyOtp update failed:", error);
      return { ok: false, error: GENERIC };
    }
    return { ok: true };
  }
  if (check.reason === "wrong") return { ok: false, error: OTP_MESSAGES.wrong(left) };
  return { ok: false, error: OTP_MESSAGES[check.reason] };
}

/** Pide el código al mail, con el enlace como prueba. Si la residencia cargó mail, va a ese; si no, al que la persona escribe. */
export async function sendInviteOtpByToken(
  admin: SupabaseClient,
  params: { rawToken: unknown; email?: string | null; now?: Date },
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const resolved = await resolveInviteByToken(admin, params.rawToken, now);
  if (!resolved.ok) return { ok: false, error: resolved.message };
  const { invite, stay } = resolved;
  const email = (stay.invite_email ?? String(params.email ?? "")).trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Revisá el mail: no parece válido." };
  const sent = await sendOtp(admin, invite, email, now);
  return sent.ok ? { ok: true, message: OTP_MESSAGES.sent } : sent;
}

export async function verifyInviteOtpByToken(
  admin: SupabaseClient,
  params: { rawToken: unknown; code: unknown; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const resolved = await resolveInviteByToken(admin, params.rawToken, now);
  if (!resolved.ok) return { ok: false, error: resolved.message };
  return verifyOtp(admin, resolved.invite, params.code, now);
}

/** Invitación abierta de una estadía, o una nueva «manual» (sin token) si la persona entró por su cuenta. Solo si el mail de la cuenta es el cargado. */
async function openInviteForStay(
  admin: SupabaseClient,
  params: { userId: string; residentStayId: string; now: Date },
): Promise<{ ok: true; invite: InviteFull; email: string } | { ok: false; error: string }> {
  const { data: user } = await admin.from("users").select("email").eq("id", params.userId).maybeSingle();
  const email = String((user as { email?: string } | null)?.email ?? "").toLowerCase();
  if (!email) return { ok: false, error: "No encontramos tu usuario." };
  const { data: stay } = await admin.from("resident_stays").select(STAY_COLS).eq("id", params.residentStayId).maybeSingle();
  const s = stay as StayLite | null;
  if (!s || !s.is_current || s.student_profile_id || (s.invite_email ?? "").toLowerCase() !== email) {
    return { ok: false, error: "No encontramos una estadía pendiente para tu mail." };
  }
  const { data: open } = await admin
    .from("resident_stay_invitations")
    .select(INVITE_COLS)
    .eq("resident_stay_id", s.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = (open?.[0] as InviteFull | undefined) ?? null;
  if (existing && evaluateInvite(existing, params.now) === "open") return { ok: true, invite: existing, email };
  if (existing) {
    // Vencida: se cierra para que el índice de «una abierta por estadía» deje crear otra.
    await admin.from("resident_stay_invitations").update({ revoked_at: params.now.toISOString(), revoke_reason: "expired" }).eq("id", existing.id);
  }
  const { data: created, error } = await admin
    .from("resident_stay_invitations")
    .insert({ resident_stay_id: s.id, residence_id: s.residence_id, channel: "manual", expires_at: inviteExpiry(params.now).toISOString() })
    .select(INVITE_COLS)
    .single();
  if (error || !created) {
    if (error && isMissingSchemaError(error)) return { ok: false, error: "La verificación por código todavía no está disponible en este entorno. Avisá a Soporte." };
    console.error("[residents] openInviteForStay insert failed:", error);
    return { ok: false, error: GENERIC };
  }
  return { ok: true, invite: created as InviteFull, email };
}

/** Estudiante con sesión: pide el código al mail de su cuenta para activar una estadía cargada con ese mail. */
export async function sendInviteOtpForStay(
  admin: SupabaseClient,
  params: { userId: string; residentStayId: string; now?: Date },
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const open = await openInviteForStay(admin, { ...params, now });
  if (!open.ok) return open;
  const sent = await sendOtp(admin, open.invite, open.email, now);
  return sent.ok ? { ok: true, message: OTP_MESSAGES.sent } : sent;
}

export async function verifyInviteOtpForStay(
  admin: SupabaseClient,
  params: { userId: string; residentStayId: string; code: unknown; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const open = await openInviteForStay(admin, { userId: params.userId, residentStayId: params.residentStayId, now });
  if (!open.ok) return open;
  return verifyOtp(admin, open.invite, params.code, now);
}
