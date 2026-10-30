import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";
import { evaluateInvite, INVITE_STATE_MESSAGES, type InviteRow } from "@/lib/residents/inviteRules";
import { resolveInviteByToken, otpRequiredFor } from "@/lib/residents/inviteVerification";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { checkStudentCanLink } from "@/lib/residents/studentLinkGuards";

/** `pendingConfirmation`: la estadía no tenía mail cargado; el enlace + código solo habilitan una solicitud que la residencia tiene que confirmar. */
export type ActivateResidentStayResult = { ok: true; residenceId: string; pendingConfirmation?: boolean } | { ok: false; error: string };
export const PENDING_CONFIRMATION_MESSAGE = "Tu residencia tiene que confirmar que sos vos. Te avisamos apenas lo haga.";

const OTP_MISSING = "Primero verificá tu mail con el código que te mandamos y después activá tu estadía.";

/**
 * Docs/05 §15.1 + DR19 — el estudiante vincula una estadía que la residencia cargó a su propia cuenta. El vínculo SIEMPRE se apoya en
 * una prueba de identidad, nunca solo en que el mail coincida:
 *  - con `rawToken` (enlace personal): canal `email` → el clic prueba el mail (y debe coincidir con la cuenta); canal `whatsapp` o
 *    estadía sin mail cargado → además exige el mail de la cuenta verificado con el código (OTP) de esa invitación.
 *  - con `residentStayId` (sin enlace): exige el mail de la cuenta verificado con código (OTP).
 * Además: una sola estadía vigente por estudiante y, si es menor, familiar/tutor vinculado. La invitación se consume (un solo uso).
 * Pasa a `active` directo; respeta el default privado de `student_visibility_settings`.
 */
export async function activateResidentStay(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId?: string; rawToken?: string | null; now?: Date },
): Promise<ActivateResidentStayResult> {
  const now = params.now ?? new Date();
  if (!params.rawToken && !params.residentStayId) return { ok: false, error: "No encontramos esa invitación." };

  const { data: user } = await admin.from("users").select("email").eq("id", params.actorUserId).maybeSingle();
  if (!user) return { ok: false, error: "No encontramos tu usuario." };
  const userEmail = String((user as { email?: string }).email ?? "").toLowerCase();

  const { data: studentProfile } = await admin.from("student_profiles").select("id").eq("user_id", params.actorUserId).maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };
  const studentProfileId = (studentProfile as { id: string }).id;

  type Stay = { id: string; invite_email: string | null; student_profile_id: string | null; status: string; residence_id: string; is_current: boolean };
  let stay: Stay | null = null;
  type ActInvite = InviteRow & { id: string; otp_email: string | null };
  let invite: ActInvite | null = null;

  if (params.rawToken) {
    const resolved = await resolveInviteByToken(admin, params.rawToken, now);
    if (!resolved.ok) return { ok: false, error: resolved.message };
    invite = resolved.invite;
    stay = resolved.stay as Stay;
  } else {
    const { data } = await admin
      .from("resident_stays")
      .select("id, invite_email, student_profile_id, status, residence_id, is_current")
      .eq("id", params.residentStayId)
      .maybeSingle();
    stay = (data as Stay | null) ?? null;
    if (!stay) return { ok: false, error: "No encontramos esa invitación." };
    if (stay.student_profile_id) return { ok: false, error: "Esa invitación ya fue activada." };
    const { data: open, error: openError } = await admin
      .from("resident_stay_invitations")
      .select("id, channel, expires_at, used_at, revoked_at, declined_at, otp_hash, otp_expires_at, otp_sent_at, otp_attempts, otp_verified_at, otp_email")
      .eq("resident_stay_id", stay.id)
      .is("used_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (openError && !isMissingSchemaError(openError)) {
      console.error("[residents] activateResidentStay invite read failed:", openError);
      return { ok: false, error: "No pudimos activar tu estadía. Intentá de nuevo." };
    }
    const row = (open?.[0] as ActInvite | undefined) ?? null;
    if (!row || evaluateInvite(row, now) !== "open") return { ok: false, error: OTP_MISSING };
    invite = row;
  }

  if (!stay.is_current || stay.student_profile_id) return { ok: false, error: INVITE_STATE_MESSAGES.used };

  // ---- Prueba de identidad ----
  const stayEmail = (stay.invite_email ?? "").toLowerCase();
  const otpOk = !!invite.otp_verified_at && !!invite.otp_email && invite.otp_email.toLowerCase() === userEmail && (!stayEmail || stayEmail === userEmail);
  if (params.rawToken) {
    if (!otpRequiredFor(invite.channel, !!stayEmail)) {
      // Canal mail con mail cargado: el clic en el enlace prueba el mail, que tiene que ser el de la cuenta.
      if (stayEmail !== userEmail) return { ok: false, error: "Esta invitación es para otro mail. Ingresá con el mail al que te llegó o pedile a tu residencia que lo corrija." };
    } else if (!otpOk) {
      return { ok: false, error: invite.otp_verified_at ? "El mail que verificaste no es el de tu cuenta. Ingresá con ese mail." : OTP_MISSING };
    }
  } else if (!otpOk) {
    return { ok: false, error: OTP_MISSING };
  }

  const guard = await checkStudentCanLink(admin, studentProfileId);
  if (!guard.ok) return { ok: false, error: guard.error };

  // Estadía SIN mail cargado: el enlace (que prueba un teléfono) + un código a un mail cualquiera no prueban que sea ESA persona. Se crea una
  // solicitud de vínculo pendiente, apuntada a la estadía, que la residencia confirma en su cola.
  if (params.rawToken && !stayEmail) {
    const { data: existing } = await admin
      .from("resident_link_requests")
      .select("id")
      .eq("student_profile_id", studentProfileId)
      .eq("residence_id", stay.residence_id)
      .eq("status", "pending")
      .maybeSingle();
    let requestId = (existing as { id: string } | null)?.id ?? null;
    if (requestId) {
      await admin.from("resident_link_requests").update({ matched_stay_id: stay.id }).eq("id", requestId).eq("status", "pending");
    } else {
      const { data: created, error: requestError } = await admin
        .from("resident_link_requests")
        .insert({ student_profile_id: studentProfileId, residence_id: stay.residence_id, status: "pending", matched_stay_id: stay.id, via_house_code: false })
        .select("id")
        .single();
      if (requestError || !created) {
        console.error("[residents] activateResidentStay link request failed:", requestError);
        return { ok: false, error: "No pudimos registrar tu pedido. Intentá de nuevo." };
      }
      requestId = (created as { id: string }).id;
    }
    const { error: usedError } = await admin
      .from("resident_stay_invitations")
      .update({ used_at: now.toISOString(), used_by_user_id: params.actorUserId })
      .eq("id", invite.id)
      .is("used_at", null);
    if (usedError) console.error("[residents] activateResidentStay mark used (pending) failed:", usedError);
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: "student",
      action: "resident_link_requested",
      entityType: "resident_link_requests",
      entityId: requestId,
      newValue: { residence_id: stay.residence_id, via: "invite_without_email" },
    });
    await notifyResidenceTeam(admin, { residenceId: stay.residence_id, event: "new_resident_link_request", entityId: requestId });
    return { ok: true, residenceId: stay.residence_id, pendingConfirmation: true };
  }

  const link = { student_profile_id: studentProfileId, status: "active" };
  // Update condicional: si otra pestaña/persona la vinculó mientras tanto, no se pisa.
  let { data: updated, error } = await admin
    .from("resident_stays")
    .update({ ...link, invite_phone: null })
    .eq("id", stay.id)
    .is("student_profile_id", null)
    .select("id");
  if (error && isMissingSchemaError(error)) {
    ({ data: updated, error } = await admin.from("resident_stays").update(link).eq("id", stay.id).is("student_profile_id", null).select("id"));
  }
  if (error) {
    console.error("[residents] activateResidentStay update failed:", error);
    return { ok: false, error: "No pudimos activar tu estadía. Intentá de nuevo." };
  }
  if (!updated || updated.length === 0) return { ok: false, error: INVITE_STATE_MESSAGES.used };

  const { error: usedError } = await admin
    .from("resident_stay_invitations")
    .update({ used_at: now.toISOString(), used_by_user_id: params.actorUserId })
    .eq("id", invite.id);
  if (usedError) console.error("[residents] activateResidentStay mark used failed:", usedError);

  // Si la residencia lo dio de alta antes de que existiera la cuenta (o la reserva), este es el momento de completar el vínculo.
  await linkStayToReservationIfMissing(admin, { residentStayId: stay.id, residenceId: stay.residence_id, studentProfileId });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "resident_stay_activated",
    entityType: "resident_stays",
    entityId: stay.id,
    newValue: { via: params.rawToken ? `token_${invite.channel}` : "email_code" },
  });

  return { ok: true, residenceId: stay.residence_id };
}
