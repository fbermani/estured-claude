"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSafeUser } from "@/lib/supabase/safe-get-user";
import { createAuditLog } from "@/lib/audit";
import { validatePasswordWithConfirmation } from "@/lib/auth/password";

export type ResetPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string; linkExpired?: boolean };

const EXPIRED: ResetPasswordState = {
  status: "error",
  message:
    "El enlace venció, ya se usó o lo abriste en otro navegador. Pedí uno nuevo para continuar.",
  linkExpired: true,
};

/**
 * Fija la contraseña nueva a partir del enlace del email (H13 / D10).
 *
 * Flujo PKCE: el `code` del enlace se canjea acá (no al cargar la página, para
 * que un prefetch del enlace no lo consuma) y recién ahí se cambia la
 * contraseña. Una cuenta bloqueada/inactiva (o sin fila en `public.users`)
 * no puede aplicar el cambio: se cierra la sesión de recuperación. Al
 * terminar se cierran todas las sesiones y se redirige a /login.
 */
export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  if (!code) return EXPIRED;

  // Validar antes de canjear: si la contraseña es inválida el enlace sigue vivo.
  const passwordError = validatePasswordWithConfirmation(password, confirmation);
  if (passwordError) return { status: "error", message: passwordError };

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return {
      status: "error",
      message: "El servicio no está disponible en este momento. Probá más tarde.",
    };
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.warn("[auth] exchangeCodeForSession:", exchangeError.code ?? exchangeError.status);
    return EXPIRED;
  }

  const user = await getSafeUser(supabase);
  if (!user) return EXPIRED;

  const { data: appUser } = await supabase
    .from("users")
    .select("is_active, is_blocked")
    .eq("id", user.id)
    .maybeSingle();

  const admin = getSupabaseAdmin();

  if (!appUser || !appUser.is_active || appUser.is_blocked) {
    await supabase.auth.signOut({ scope: "local" });
    if (admin) {
      await createAuditLog(admin, {
        actorUserId: user.id,
        actorRole: "registered_user",
        action: "password_reset_denied",
        entityType: "users",
        entityId: user.id,
        reasonCode: "account_not_enabled",
      });
    }
    return {
      status: "error",
      message: "Tu cuenta no está habilitada. Escribinos si creés que es un error.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.warn("[auth] updateUser(password):", updateError.code ?? updateError.status);
    // El código ya se canjeó: no dejar la sesión de recuperación abierta.
    await supabase.auth.signOut({ scope: "local" });
    const retry = "Por seguridad el enlace ya se usó: pedí uno nuevo para volver a intentarlo.";
    if (updateError.code === "same_password") {
      return {
        status: "error",
        message: `Elegí una contraseña distinta de la anterior. ${retry}`,
        linkExpired: true,
      };
    }
    if (updateError.code === "weak_password") {
      return {
        status: "error",
        message: `Esa contraseña es demasiado fácil de adivinar: usá una más larga o variada. ${retry}`,
        linkExpired: true,
      };
    }
    return {
      status: "error",
      message: "No pudimos actualizar tu contraseña. Pedí un enlace nuevo e intentá otra vez.",
      linkExpired: true,
    };
  }

  if (admin) {
    await createAuditLog(admin, {
      actorUserId: user.id,
      actorRole: "registered_user",
      action: "password_reset_completed",
      entityType: "users",
      entityId: user.id,
    });
  }

  // Cierra todas las sesiones (también la de recuperación): hay que ingresar de nuevo.
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (error) {
    console.warn("[auth] signOut global tras reset falló:", error);
  }

  redirect("/login?reset=ok");
}
