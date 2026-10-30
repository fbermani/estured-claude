"use server";

import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { declineResidentInvitation, sendInviteOtpByToken, verifyInviteOtpByToken } from "@/lib/residents/inviteVerification";
import { INVITE_TOO_MANY_ATTEMPTS, inviteAttemptAllowed, inviteCodeRequestAllowed } from "@/lib/residents/inviteThrottle";

export type InviteStepState = { status: "idle" | "error" | "sent" | "verified" | "declined"; message?: string };

const UNAVAILABLE = "No está disponible en este momento. Probá más tarde.";

/**
 * Pasos de la invitación personal (DR19) que no necesitan sesión: el token del enlace es la prueba. Con `useSessionEmail` (persona ya
 * logueada) el código va al mail de SU cuenta; si no, al mail que cargó la residencia o, si no cargó, al que escribe la persona.
 */
export async function sendInviteCodeAction(
  token: string,
  useSessionEmail: boolean,
  _prev: InviteStepState,
  formData: FormData,
): Promise<InviteStepState> {
  const headerStore = await headers();
  if (!inviteAttemptAllowed(headerStore, token) || !inviteCodeRequestAllowed(token)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: UNAVAILABLE };

  let email = String(formData.get("email") ?? "");
  if (useSessionEmail) {
    const session = await getSessionUser();
    if (!session) return { status: "error", message: "Tu sesión expiró. Ingresá de nuevo." };
    email = session.email;
  }
  const result = await sendInviteOtpByToken(admin, { rawToken: token, email });
  return result.ok ? { status: "sent", message: result.message } : { status: "error", message: result.error };
}

export async function verifyInviteCodeAction(token: string, _prev: InviteStepState, formData: FormData): Promise<InviteStepState> {
  const headerStore = await headers();
  if (!inviteAttemptAllowed(headerStore, token)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: UNAVAILABLE };
  const result = await verifyInviteOtpByToken(admin, { rawToken: token, code: String(formData.get("code") ?? "").trim() });
  return result.ok ? { status: "verified" } : { status: "error", message: result.error };
}

/** «No vivo ahí / no soy yo». La residencia lo ve en su lista de residentes. */
export async function declineInviteAction(token: string, _prev: InviteStepState): Promise<InviteStepState> {
  const headerStore = await headers();
  if (!inviteAttemptAllowed(headerStore, token)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: UNAVAILABLE };
  const result = await declineResidentInvitation(admin, {
    rawToken: token,
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerStore.get("user-agent"),
  });
  return result.ok
    ? { status: "declined", message: "Listo, le avisamos a la residencia que no sos vos. El enlace dejó de funcionar." }
    : { status: "error", message: result.error };
}
