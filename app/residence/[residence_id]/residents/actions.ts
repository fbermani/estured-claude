"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { endResidentStay } from "@/lib/residents/endResidentStay";
import { updateStayDetails } from "@/lib/residents/updateStayDetails";
import { assignStayToBed } from "@/lib/residences/roomManagement";
import { setResidentEmail } from "@/lib/residents/setResidentEmail";
import { addResidentNote } from "@/lib/residents/addResidentNote";
import { issueResidentInvite } from "@/lib/residents/residentInvitations";
import { regenerateHouseCode, resolveLinkRequest } from "@/lib/residents/linkRequestsResidence";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";

export type ResidentsActionState = { status: "idle" | "error" | "saved"; message?: string; waUrl?: string };

export async function createResidentStayAction(
  residenceId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const inviteEmail = String(formData.get("invite_email") ?? "").trim() || null;
  const inviteName = String(formData.get("invite_name") ?? "").trim() || null;
  const invitePhone = String(formData.get("invite_phone") ?? "").trim() || null;
  const roomTypeId = String(formData.get("room_type_id") ?? "") || null;
  const startDate = String(formData.get("start_date") ?? "") || null;

  const result = await createResidentStay(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    inviteEmail,
    inviteName,
    invitePhone,
    roomTypeId,
    reservationId: null,
    startDate,
    expectedEndDate: String(formData.get("expected_end_date") ?? "") || null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  // DR19: al cargar un residente con mail le sale la invitación personal («Residencia X te invita, vía EstuRed»).
  let message: string | undefined;
  if (inviteEmail) {
    const invite = await issueResidentInvite(admin, {
      actorUserId: sessionUser.id,
      residenceId,
      residentStayId: result.residentStayId,
      channel: "email",
    });
    message = invite.ok && invite.emailSent ? `Le mandamos la invitación a ${inviteEmail}.` : "Cargamos al residente, pero no pudimos mandarle el mail. Reenviá la invitación desde su ficha.";
  }

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved", ...(message ? { message } : {}) };
}

export async function updateStayDetailsAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const rateRaw = String(formData.get("monthly_rate_usd") ?? "").trim();
  const result = await updateStayDetails(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    expectedEndDate: String(formData.get("expected_end_date") ?? "") || null,
    monthlyRateUsd: rateRaw ? Number(rateRaw) : null,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function assignBedToStayAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const bedId = String(formData.get("bed_id") ?? "");
  if (!bedId) return { status: "error", message: "Elegí una cama." };

  const result = await assignStayToBed(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    bedId,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved" };
}

export async function endResidentStayAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await endResidentStay(admin, { actorUserId: sessionUser.id, residentStayId, endDate: null });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  // Si la estadía se cerró pero no se repuso la disponibilidad (staff sin el permiso de disponibilidad), se le dice.
  return result.warning ? { status: "saved", message: result.warning } : { status: "saved" };
}

/**
 * Salida anticipada (DR3): la residencia actual finaliza la estadía registrando fecha real, devolución del depósito
 * (`returned` / `not_returned` / `no_deposit`) y una nota libre. Campos: `exit_date`, `deposit_status`, `residence_note`.
 */
export async function endResidentStayEarlyExitAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await endResidentStay(admin, {
    actorUserId: sessionUser.id,
    residentStayId,
    endDate: null,
    earlyExit: {
      exitDate: formData.get("exit_date"),
      depositStatus: formData.get("deposit_status"),
      residenceNote: formData.get("residence_note"),
    },
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return {
    status: "saved",
    message: `${result.warning ?? "Registramos la salida."} ${UNPAID_DISCLAIMER}`,
  };
}

export async function addResidentNoteAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const category = String(formData.get("category") ?? "general");
  const result = await addResidentNote(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    category: category === "pagos" ? "pagos" : "general",
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved" };
}

/** Reenviar la invitación por mail: genera un enlace nuevo y el anterior deja de servir. */
export async function resendInvitationAction(residenceId: string, residentStayId: string, _prev: ResidentsActionState): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await issueResidentInvite(admin, { actorUserId: sessionUser.id, residenceId, residentStayId, channel: "email" });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/residents`);
  return result.emailSent
    ? { status: "saved", message: "Reenviamos la invitación. El enlace anterior ya no sirve." }
    : { status: "error", message: "No pudimos enviar el mail. Probá de nuevo en unos minutos o compartí el enlace por WhatsApp." };
}

/** Enlace personal para compartir por WhatsApp (MANUAL: se abre wa.me con el mensaje armado; nunca la API). Invalida el enlace anterior. */
export async function generateWhatsappInviteAction(residenceId: string, residentStayId: string, _prev: ResidentsActionState): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await issueResidentInvite(admin, { actorUserId: sessionUser.id, residenceId, residentStayId, channel: "whatsapp" });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved", waUrl: result.whatsappUrl ?? undefined, message: "Armamos el mensaje con su enlace personal. Los enlaces anteriores dejaron de servir." };
}

/** Aprobar o rechazar una solicitud de vínculo (DR19). Campos: `decision` (approve/reject), opcionales `stay_id` (unir a una estadía sin cuenta) y `note`. */
export async function resolveLinkRequestAction(
  residenceId: string,
  requestId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  // Dos botones nativos con name/value en el mismo formulario (sin onClick + setState): la decisión llega en el FormData.
  const decision = formData.get("decision") === "approve" ? "approve" : "reject";
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await resolveLinkRequest(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    requestId,
    decision,
    stayId: String(formData.get("stay_id") ?? "") || null,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/residents`);
  revalidatePath(`/residence/${residenceId}/rooms`);
  return { status: "saved", message: decision === "approve" ? "Vinculado. Ya figura como residente." : "Rechazaste la solicitud." };
}

/** Código de casa: genera uno nuevo (el anterior deja de servir). */
export async function regenerateHouseCodeAction(residenceId: string, _prev: ResidentsActionState): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };
  const result = await regenerateHouseCode(admin, { actorUserId: sessionUser.id, residenceId });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/residence/${residenceId}/residents`);
  return { status: "saved", message: result.code };
}

/** Cargar el mail de un residente que se había cargado sin mail (DR18 t4, punto 20). Validación y permiso en `setResidentEmail`. */
export async function setResidentEmailAction(
  residenceId: string,
  residentStayId: string,
  _prev: ResidentsActionState,
  formData: FormData,
): Promise<ResidentsActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidentEmail(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    residentStayId,
    email: String(formData.get("email") ?? ""),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/residents`);
  return {
    status: "saved",
    message: result.emailSent ? "Guardamos el mail y mandamos una invitación nueva (la anterior ya no sirve)." : "Guardamos el mail, pero no pudimos mandar la invitación. Reenviala desde la ficha.",
  };
}
