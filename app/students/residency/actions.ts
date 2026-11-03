"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { activateResidentStay } from "@/lib/residents/activateResidentStay";
import { sendInviteOtpForStay, verifyInviteOtpForStay } from "@/lib/residents/inviteVerification";
import { INVITE_TOO_MANY_ATTEMPTS, inviteAttemptAllowed, residencyStepAllowed } from "@/lib/residents/inviteThrottle";
import { headers } from "next/headers";
import { submitLinkRequest, submitMissingResidence, cancelLinkRequest } from "@/lib/residents/linkRequestsStudent";
import { setResidentVisibility } from "@/lib/residents/setResidentVisibility";

export type ResidencyActionState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * Activar una estadía cargada con el mail de la cuenta, SIN enlace personal (DR19): exige el mail verificado con un código.
 * Paso 1: pedir el código al mail de la cuenta.
 */
export async function sendResidencyCodeAction(residentStayId: string, _prev: ResidencyActionState): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  if (!residencyStepAllowed(sessionUser.id)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await sendInviteOtpForStay(admin, { userId: sessionUser.id, residentStayId });
  return result.ok ? { status: "saved", message: result.message } : { status: "error", message: result.error };
}

/** Paso 2: verificar el código y, si es correcto, activar la estadía. */
export async function activateWithCodeAction(
  residentStayId: string,
  _prev: ResidencyActionState,
  formData: FormData,
): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  if (!residencyStepAllowed(sessionUser.id)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const verified = await verifyInviteOtpForStay(admin, { userId: sessionUser.id, residentStayId, code: String(formData.get("code") ?? "").trim() });
  if (!verified.ok) return { status: "error", message: verified.error };
  const result = await activateResidentStay(admin, { actorUserId: sessionUser.id, residentStayId });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/residency");
  if (result.pendingGuardian) return { status: "saved", message: "Listo. Le avisamos a tu familiar: tu estadía queda activa apenas la confirme." };
  return { status: "saved", message: "Listo, tu estadía quedó activa." };
}

/** Activar con el enlace personal de la residencia (la persona ya tiene cuenta y sesión). */
export async function activateWithInviteAction(token: string, _prev: ResidencyActionState): Promise<ResidencyActionState> {
  const headerStore = await headers();
  if (!inviteAttemptAllowed(headerStore, token)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Ingresá de nuevo." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await activateResidentStay(admin, { actorUserId: sessionUser.id, rawToken: token });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/students/residency");
  redirect(result.pendingConfirmation ? "/students/residency?pendiente=1" : "/students/residency");
}

/** Estudiante alojado que se registró solo: pide que su residencia lo vincule (por lista o por código de casa). Nunca vincula sola. */
export async function submitLinkRequestAction(_prev: ResidencyActionState, formData: FormData): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  if (!residencyStepAllowed(sessionUser.id)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await submitLinkRequest(admin, {
    actorUserId: sessionUser.id,
    residenceId: String(formData.get("residence_id") ?? "") || null,
    houseCode: String(formData.get("house_code") ?? "") || null,
    message: String(formData.get("message") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/students/residency");
  return { status: "saved", message: `Le mandamos tu solicitud a ${result.residenceName}. Nada queda vinculado hasta que la residencia la apruebe.` };
}

export async function cancelLinkRequestAction(requestId: string, _prev: ResidencyActionState): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await cancelLinkRequest(admin, { actorUserId: sessionUser.id, requestId });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/students/residency");
  return { status: "saved" };
}

/** «Mi residencia no está»: nombre + contacto opcional; avisa a los admins. */
export async function submitMissingResidenceAction(_prev: ResidencyActionState, formData: FormData): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  if (!residencyStepAllowed(sessionUser.id)) return { status: "error", message: INVITE_TOO_MANY_ATTEMPTS };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await submitMissingResidence(admin, {
    actorUserId: sessionUser.id,
    residenceName: formData.get("residence_name"),
    contact: formData.get("contact"),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/students/residency");
  return { status: "saved", message: "Gracias, le avisamos al equipo de EstuRed. Cuando tu residencia se sume, vas a poder pedir el vínculo desde acá." };
}

export async function setResidentVisibilityAction(
  residentStayId: string,
  hidden: boolean,
  _prev: ResidencyActionState,
): Promise<ResidencyActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidentVisibility(admin, { actorUserId: sessionUser.id, residentStayId, hidden });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/residency");
  return { status: "saved" };
}
