import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/sendEmail";
import { generateOtpCode, hashOtp } from "@/lib/residents/inviteRules";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MINUTES } from "@/lib/residents/inviteConstants";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Verificación del mail del familiar (DR32 addendum, migración 0072). Un código de 6 dígitos al mail de la cuenta prueba que quien
 * registró controla ese mail; NO prueba que sea adulto o tutor (responsabilidad declarada, docs/10 §9.6). Mismo patrón que el código de
 * DR19: solo se guarda el hash, vence a los 10 min, 5 intentos y reenvío cada 60 s. Todo con service role; falla cerrado.
 */

export type FamilyVerifyResult = { ok: true } | { ok: false; error: string };
const GENERIC = "No pudimos completar la acción. Intentá de nuevo.";
const NOT_AVAILABLE = "Esta función todavía no está disponible en este entorno. Avisá a Soporte.";

export async function isFamilyEmailVerified(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("family_email_verifications").select("verified_at").eq("user_id", userId).maybeSingle();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[family] verification read failed:", error);
    return false;
  }
  return !!(data as { verified_at: string | null } | null)?.verified_at;
}

export async function sendFamilyEmailCode(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<FamilyVerifyResult> {
  const { data: user } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
  const email = (user as { email?: string } | null)?.email;
  if (!email) return { ok: false, error: GENERIC };
  const { data: row, error } = await admin.from("family_email_verifications").select("sent_at, verified_at").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: isMissingSchemaError(error) ? NOT_AVAILABLE : GENERIC };
  const current = row as { sent_at: string | null; verified_at: string | null } | null;
  if (current?.verified_at) return { ok: true };
  if (current?.sent_at && now.getTime() - new Date(current.sent_at).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return { ok: false, error: `Esperá un minuto antes de pedir otro código.` };
  }
  const code = generateOtpCode();
  const { error: upsertError } = await admin.from("family_email_verifications").upsert({
    user_id: userId,
    code_hash: hashOtp(code, userId),
    expires_at: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
    attempts: 0,
    sent_at: now.toISOString(),
  });
  if (upsertError) {
    console.error("[family] verification upsert failed:", upsertError);
    return { ok: false, error: isMissingSchemaError(upsertError) ? NOT_AVAILABLE : GENERIC };
  }
  await sendEmail({
    to: email,
    subject: "Tu código de EstuRed",
    html: `<p>Tu código para verificar tu mail en EstuRed es <strong>${code}</strong>. Vence en ${OTP_TTL_MINUTES} minutos.</p><p>Si no lo pediste vos, ignorá este mensaje.</p>`,
  });
  return { ok: true };
}

const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function verifyFamilyEmailCode(admin: SupabaseClient, userId: string, code: string, now: Date = new Date()): Promise<FamilyVerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "El código tiene 6 números." };
  const { data, error } = await admin.from("family_email_verifications").select("code_hash, expires_at, attempts, verified_at").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: isMissingSchemaError(error) ? NOT_AVAILABLE : GENERIC };
  const row = data as { code_hash: string | null; expires_at: string | null; attempts: number; verified_at: string | null } | null;
  if (row?.verified_at) return { ok: true };
  if (!row?.code_hash || !row.expires_at || new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, error: "El código venció. Pedí uno nuevo." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "Superaste los intentos. Pedí un código nuevo." };
  // Se cuenta el intento ANTES de comparar (condicional: dos pedidos en paralelo no se reparten el mismo cupo).
  const { data: bumped } = await admin.from("family_email_verifications").update({ attempts: row.attempts + 1 }).eq("user_id", userId).eq("attempts", row.attempts).select("user_id");
  if (!bumped || bumped.length === 0) return { ok: false, error: GENERIC };
  if (!sameHash(row.code_hash, hashOtp(code, userId))) return { ok: false, error: "Ese código no es correcto." };
  const { error: doneError } = await admin
    .from("family_email_verifications")
    .update({ verified_at: now.toISOString(), code_hash: null, expires_at: null })
    .eq("user_id", userId);
  if (doneError) return { ok: false, error: GENERIC };
  return { ok: true };
}
