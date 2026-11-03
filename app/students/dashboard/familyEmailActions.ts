"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendFamilyEmailCode, verifyFamilyEmailCode } from "@/lib/family/emailVerification";

export type FamilyEmailResult = { ok: true } | { ok: false; message: string };

async function familyContext() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !sessionUser.roles.includes("family_member")) return null;
  const admin = getSupabaseAdmin();
  return admin ? { admin, userId: sessionUser.id } : null;
}

/** Verifica el mail de la cuenta del familiar logueado (DR32 addendum). Solo opera sobre la propia cuenta. */
export async function verifyFamilyEmailAction(code: string): Promise<FamilyEmailResult> {
  const ctx = await familyContext();
  if (!ctx) return { ok: false, message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const result = await verifyFamilyEmailCode(ctx.admin, ctx.userId, String(code ?? "").trim());
  return result.ok ? { ok: true } : { ok: false, message: result.error };
}

export async function resendFamilyEmailCodeAction(): Promise<FamilyEmailResult> {
  const ctx = await familyContext();
  if (!ctx) return { ok: false, message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const result = await sendFamilyEmailCode(ctx.admin, ctx.userId);
  return result.ok ? { ok: true } : { ok: false, message: result.error };
}
