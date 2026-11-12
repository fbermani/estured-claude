"use server";

import { safeInternalPath } from "@/lib/auth/safeNext";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { getSafeUser } from "@/lib/supabase/safe-get-user";
import { createAuditLog } from "@/lib/audit";
import { clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { consumeRateLimit, emailRateLimitKey, isRateLimited } from "@/lib/security/rateLimit";

export type AuthState = { status: "idle" | "error"; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ventana de los límites de login (M6), persistentes en Postgres. Cuentan solo intentos FALLIDOS. */
const LOGIN_WINDOW_SECONDS = 15 * 60;
/** Mismo mensaje para todos los límites: no revela si la cuenta existe. */
const TOO_MANY_LOGIN_ATTEMPTS = "Hiciste muchos intentos. Esperá unos minutos y probá de nuevo.";

/** Umbrales de fallidos por ventana: por IP, por (IP + email) y por email solo (alto, anti-lockout dirigido). */
function loginLimits(email: string, ip: string) {
  return [
    { bucket: "login_ip", key: ip, windowSeconds: LOGIN_WINDOW_SECONDS, max: 50 },
    { bucket: "login_ip_email", key: `${ip}|${emailRateLimitKey(email)}`, windowSeconds: LOGIN_WINDOW_SECONDS, max: 5 },
    { bucket: "login_email", key: emailRateLimitKey(email), windowSeconds: LOGIN_WINDOW_SECONDS, max: 20 },
  ];
}

/**
 * Frena credential stuffing: `signInWithPassword` corre en el servidor, así que el límite por IP de Supabase ve la IP de Vercel y no
 * la del cliente. Antes de intentar se consulta (sin consumir) si alguna clave ya está bloqueada; solo un intento fallido consume.
 */
async function loginBlocked(email: string, ip: string): Promise<boolean> {
  for (const limit of loginLimits(email, ip)) {
    if (await isRateLimited(limit)) return true;
  }
  return false;
}

async function registerFailedLogin(email: string, ip: string): Promise<void> {
  for (const limit of loginLimits(email, ip)) await consumeRateLimit(limit);
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!EMAIL_RE.test(email) || password.length < 1) {
    return { status: "error", message: "Completá email y contraseña." };
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return {
      status: "error",
      message: "El servicio no está disponible en este momento. Probá más tarde.",
    };
  }

  const ip = clientKeyFromHeaders(await headers());
  if (await loginBlocked(email, ip)) {
    return { status: "error", message: TOO_MANY_LOGIN_ATTEMPTS };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await registerFailedLogin(email, ip);
    return { status: "error", message: "Email o contraseña incorrectos." };
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    await admin
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    // Cuenta auth sin fila en public.users (o bloqueada/inactiva).
    await supabase.auth.signOut();
    return {
      status: "error",
      message:
        "Tu cuenta no está habilitada. Escribinos si creés que es un error.",
    };
  }

  // Solo rutas internas como destino post-login.
  const safeNext = safeInternalPath(next);
  redirect(safeNext ?? roleHome(sessionUser));
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) {
    const user = await getSafeUser(supabase);
    await supabase.auth.signOut();
    const admin = getSupabaseAdmin();
    if (admin && user) {
      await createAuditLog(admin, {
        actorUserId: user.id,
        actorRole: "registered_user",
        action: "user_logged_out",
        entityType: "users",
        entityId: user.id,
      });
    }
  }
  redirect("/");
}
