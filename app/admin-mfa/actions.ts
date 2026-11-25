"use server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * DR65 (d): enrolamiento y verificación del MFA TOTP del admin. Corre con la sesión del propio usuario (cookies): Supabase guarda el
 * factor y, al verificar, sube la sesión a `aal2` y reescribe las cookies. Solo para cuentas con rol admin o superadmin.
 */
export type EnrollState = { status: "idle" } | { status: "error"; message: string } | { status: "ready"; factorId: string; qr: string; secret: string };
export type VerifyState = { status: "idle" } | { status: "error"; message: string } | { status: "verified" };

async function adminClient() {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user, ["admin", "superadmin"])) return null;
  const supabase = await getSupabaseServer();
  return supabase ? { user, supabase } : null;
}

export async function startTotpEnrollment(): Promise<EnrollState> {
  const ctx = await adminClient();
  if (!ctx) return { status: "error", message: "No tenés permiso para esta acción." };
  const { data: factors, error: listError } = await ctx.supabase.auth.mfa.listFactors();
  if (listError) return { status: "error", message: "No pudimos leer tus métodos de verificación. Probá de nuevo." };
  if ((factors?.totp ?? []).some((f) => f.status === "verified")) {
    return { status: "error", message: "Ya tenés una app de autenticación. Ingresá el código de 6 dígitos." };
  }
  // Un intento anterior sin terminar deja un factor sin verificar: se descarta para empezar limpio.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await ctx.supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await ctx.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `EstuRed admin ${Date.now()}` });
  if (error || !data) return { status: "error", message: "No pudimos generar el código QR. Probá de nuevo." };
  return { status: "ready", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const ctx = await adminClient();
  if (!ctx) return { status: "error", message: "No tenés permiso para esta acción." };
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { status: "error", message: "El código tiene 6 dígitos." };

  let factorId = String(formData.get("factor_id") ?? "");
  if (!factorId) {
    const { data: factors } = await ctx.supabase.auth.mfa.listFactors();
    factorId = factors?.totp?.find((f) => f.status === "verified")?.id ?? "";
  }
  if (!factorId) return { status: "error", message: "Primero configurá tu app de autenticación." };

  const { error } = await ctx.supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { status: "error", message: "El código no es válido o venció. Probá con el código nuevo de tu app." };

  const admin = getSupabaseAdmin();
  if (admin) {
    await createAuditLog(admin, {
      actorUserId: ctx.user.id,
      actorRole: ctx.user.roles.includes("superadmin") ? "superadmin" : "admin",
      action: "admin_mfa_verified",
      entityType: "users",
      entityId: ctx.user.id,
    });
  }
  return { status: "verified" };
}
