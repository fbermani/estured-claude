"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type AuthState = { status: "idle" | "error"; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
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
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(safeNext ?? roleHome(sessionUser));
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
