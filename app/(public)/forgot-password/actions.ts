"use server";

import { headers } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/appUrl";
import { clientKeyFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { padToMinimum, resetByEmailAllowed, resetByIpAllowed } from "@/lib/auth/resetThrottle";

export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pide el enlace de recuperación de contraseña (H13 / D10).
 *
 * La respuesta es SIEMPRE neutra una vez que el email tiene formato válido:
 * no revela si la cuenta existe, está bloqueada, superó su límite o si el envío
 * falló (errores y rate limit de Supabase solo se loguean). Las cuentas
 * bloqueadas/inactivas no reciben el enlace; `resetPassword` lo vuelve a
 * verificar al aplicar el cambio.
 *
 * Contra enumeración por tiempos: todas las ramas hacen el mismo trabajo
 * observable (una llamada a Supabase Auth; las que no deben enviar usan una
 * dirección inexistente) y la respuesta se rellena hasta un piso fijo.
 *
 * Límites propios: 5 pedidos por hora por IP (error explícito, no revela nada
 * de la cuenta) y 3 por hora por email (silencioso). Persistentes en Postgres,
 * con las claves hasheadas: ver `lib/auth/resetThrottle.ts`.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const startedAt = Date.now();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: "error", message: "Revisá tu email: no parece válido." };
  }

  if (!(await resetByIpAllowed(clientKeyFromHeaders(await headers())))) {
    return {
      status: "error",
      message: "Hiciste varios pedidos seguidos. Esperá un rato y probá de nuevo.",
    };
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return {
      status: "error",
      message: "El servicio no está disponible en este momento. Probá más tarde.",
    };
  }

  let shouldSend = await resetByEmailAllowed(email);
  if (shouldSend) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: appUser } = await admin
        .from("users")
        .select("is_active, is_blocked")
        .eq("email", email)
        .maybeSingle();
      if (appUser && (appUser.is_blocked || !appUser.is_active)) shouldSend = false;
    }
  }

  // Misma llamada en todas las ramas; si no corresponde enviar, el destino no existe.
  const target = shouldSend ? email : `noop-${crypto.randomUUID()}@estured.invalid`;
  const appUrl = getAppUrl();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${appUrl}/reset-password`,
    });
    if (error) {
      console.warn("[auth] resetPasswordForEmail:", error.code ?? error.status, error.message);
    }
  } catch (error) {
    console.warn("[auth] resetPasswordForEmail failed:", error);
  }

  await padToMinimum(startedAt);
  return { status: "sent" };
}
