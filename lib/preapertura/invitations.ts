import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Invitación familiar de la preapertura (DR43.2): el familiar mayor se registra primero e invita a su hijo/a. UNA sola invitación por
 * familiar (unique en la tabla), sin recordatorios ni reenvío. Solo se guarda el hash del token: el link se muestra una vez al
 * familiar (botón «Copiar link») y se manda por mail si hay proveedor. Todo con service role; falla cerrado.
 */
export const INVITE_TTL_DAYS = 30;

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function isPlausibleInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export type CreateInvitationResult = { ok: true; token: string } | { ok: false };

export async function createInvitation(admin: SupabaseClient, inviterUserId: string, inviteeEmail: string, now: Date = new Date()): Promise<CreateInvitationResult> {
  const { token, hash } = newInviteToken();
  const { error } = await admin.from("preapertura_invitaciones").insert({
    inviter_user_id: inviterUserId,
    invitee_email: inviteeEmail,
    token_hash: hash,
    expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[preapertura] invitation insert failed:", error.code);
    return { ok: false };
  }
  return { ok: true, token };
}

export type ResolvedInvitation = { id: string; inviterUserId: string; email: string };
export type ResolveInvitationResult =
  | { ok: true; invitation: ResolvedInvitation }
  | { ok: false; reason: "invalid" | "expired" | "used" | "unavailable" };

export const INVITE_MESSAGES: Record<"invalid" | "expired" | "used" | "unavailable", string> = {
  invalid: "Este link de invitación no es válido. Pedile a tu familiar que te pase el que copió al registrarse.",
  expired: "Este link de invitación venció. Pedile a tu familiar que te pase uno vigente.",
  used: "Este link de invitación ya se usó. Si ya tenés cuenta, ingresá.",
  unavailable: "La invitación no está disponible en este momento. Probá más tarde.",
};

export async function resolveInvitation(admin: SupabaseClient, token: unknown, now: Date = new Date()): Promise<ResolveInvitationResult> {
  if (!isPlausibleInviteToken(token)) return { ok: false, reason: "invalid" };
  const { data, error } = await admin
    .from("preapertura_invitaciones")
    .select("id, inviter_user_id, invitee_email, expires_at, redeemed_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[preapertura] invitation read failed:", error.code);
    return { ok: false, reason: "unavailable" };
  }
  if (!data) return { ok: false, reason: "invalid" };
  const row = data as { id: string; inviter_user_id: string; invitee_email: string; expires_at: string; redeemed_at: string | null };
  if (row.redeemed_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, invitation: { id: row.id, inviterUserId: row.inviter_user_id, email: row.invitee_email } };
}

/** Marca la invitación como canjeada SOLO si sigue libre (un update condicional: dos canjes simultáneos no pasan los dos). */
export async function redeemInvitation(admin: SupabaseClient, invitationId: string, userId: string, now: Date = new Date()): Promise<boolean> {
  const { data, error } = await admin
    .from("preapertura_invitaciones")
    .update({ redeemed_at: now.toISOString(), redeemed_by_user_id: userId })
    .eq("id", invitationId)
    .is("redeemed_at", null)
    .select("id");
  if (error) {
    console.error("[preapertura] invitation redeem failed:", error.code);
    return false;
  }
  return (data ?? []).length === 1;
}
