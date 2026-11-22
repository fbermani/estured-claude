"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { validatePasswordWithConfirmation } from "@/lib/auth/password";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createRateLimiter, clientKeyFromHeaders, clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { acceptTeamInvitation, peekTeamInvitation } from "@/lib/team/teamInvitations";
import { INVALID_INVITATION_MESSAGE } from "@/lib/team/teamRules";
import { consentVersion } from "@/lib/legal/consentVersion";

export type AcceptInvitationState = { status: "idle" | "error"; message?: string };


/**
 * Frenos del formulario de aceptación (DR10): en memoria y por instancia (best-effort en serverless, igual que `verifyRateLimit` y
 * `resetThrottle`); el límite real va en el WAF de Vercel. Las claves son hashes (IP y token), nunca texto plano.
 */
const attemptsByClient = createRateLimiter({ limit: 15, windowMs: 3_600_000 });
const attemptsByToken = createRateLimiter({ limit: 10, windowMs: 3_600_000 });

/** Mensaje único para cualquier falla de credenciales o de datos: no distingue cuenta nueva de existente. */
const NEUTRAL_ERROR =
  "No pudimos completar el paso con esos datos. Revisá la contraseña: si es tu primera vez en EstuRed, elegí una de al menos 8 caracteres y repetila en el segundo campo.";
const TOO_MANY_ATTEMPTS = "Hiciste muchos intentos. Probá de nuevo en un rato.";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function requestMeta() {
  const headerStore = await headers();
  return {
    clientKey: sha(clientKeyFromHeaders(headerStore)),
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

/** Ya hay una sesión con el email invitado: aceptar con un clic. La identidad sale de la sesión, nunca del formulario. */
export async function acceptInvitationWithSession(
  token: string,
  _prev: AcceptInvitationState,
): Promise<AcceptInvitationState> {
  const meta = await requestMeta();
  if (!attemptsByClient(meta.clientKey) || !attemptsByToken(sha(String(token)))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Ingresá con tu contraseña para aceptar." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No está disponible en este momento. Probá más tarde." };

  const result = await acceptTeamInvitation(admin, {
    rawToken: token,
    userId: sessionUser.id,
    userEmail: sessionUser.email,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  if (!result.ok) return { status: "error", message: result.error };
  redirect(`/residence/${result.residenceId}`);
}

/**
 * Aceptar con contraseña: el email es SIEMPRE el de la invitación (no se lee del formulario). Si ya hay una cuenta con ese email se
 * inicia sesión; si no, se crea una cuenta de staff (el token llegó por email, así que equivale a verificar el email). Todos los
 * errores de credenciales y de datos devuelven el mismo mensaje neutral.
 */
export async function acceptInvitationWithPassword(
  token: string,
  _prev: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const meta = await requestMeta();
  if (!attemptsByClient(meta.clientKey) || !attemptsByToken(sha(String(token)))) {
    return { status: "error", message: TOO_MANY_ATTEMPTS };
  }

  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  if (!admin || !supabase) return { status: "error", message: "No está disponible en este momento. Probá más tarde." };

  const invitation = await peekTeamInvitation(admin, token);
  if (invitation.state !== "valid") return { status: "error", message: INVALID_INVITATION_MESSAGE };
  const email = invitation.email;

  if (formData.get("accept_terms") !== "on" || formData.get("accept_privacy") !== "on") {
    return { status: "error", message: "Necesitamos que aceptes los términos y la política de privacidad." };
  }
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  const { data: existingUser } = await admin.from("users").select("id").eq("email", email).maybeSingle();

  let userId: string;
  // Solo se borra la cuenta si la creó ESTE request (nunca una que ya existía).
  let createdHere = false;
  if (existingUser) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { status: "error", message: NEUTRAL_ERROR };
    userId = data.user.id;
  } else {
    if (validatePasswordWithConfirmation(password, confirmation)) return { status: "error", message: NEUTRAL_ERROR };

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      if (createError?.code !== "email_exists") console.error("[team-accept] createUser failed:", createError?.message);
      return { status: "error", message: NEUTRAL_ERROR };
    }
    userId = created.user.id;
    createdHere = true;
    try {
      const { error: userError } = await admin.from("users").insert({ id: userId, email, primary_role: "residence_staff" });
      if (userError) throw userError;
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "residence_staff", scope_type: "global", scope_id: null });
      if (roleError) throw roleError;
      const consentBase = {
        user_id: userId,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
        related_entity_type: "residences",
        related_entity_id: invitation.residenceId,
      };
      const { error: consentError } = await admin.from("consents").insert([
        { ...consentBase, consent_type: "terms", version: consentVersion("terms"), metadata: {} },
        { ...consentBase, consent_type: "privacy", version: consentVersion("privacy"), metadata: {} },
      ]);
      if (consentError) throw consentError;
    } catch (error) {
      console.error("[team-accept] rollback, account setup failed:", error);
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return { status: "error", message: "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos." };
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return { status: "error", message: NEUTRAL_ERROR };
    }
  }

  const result = await acceptTeamInvitation(admin, {
    rawToken: token,
    userId,
    userEmail: email,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  if (!result.ok) {
    // Cuenta recién creada en este request que no pudo sumarse al equipo: se borra para no dejar cuentas huérfanas.
    if (createdHere) await admin.auth.admin.deleteUser(userId).catch(() => {});
    // No se deja abierta una sesión que no pudo sumarse al equipo (por ejemplo una cuenta de estudiante).
    if (result.code === "not_eligible" || result.code === "email_mismatch") await supabase.auth.signOut();
    return { status: "error", message: result.error };
  }
  redirect(`/residence/${result.residenceId}`);
}
