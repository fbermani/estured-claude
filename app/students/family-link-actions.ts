"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { resetFeePayersOnLinkEnd } from "@/lib/family/setFeePayer";
import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sendEmail";
import { isFamilyEmailVerified } from "@/lib/family/emailVerification";
import { escapeHtml, safeSubjectName } from "@/lib/residenceSignup/confirmationEmail";
import { getAppUrl } from "@/lib/appUrl";

export type FamilyLinkDecisionState = { status: "idle" | "error"; message?: string };
export type FamilyInviteState = { status: "idle" | "error" | "sent"; message?: string };

/**
 * El estudiante aprueba o rechaza una solicitud de vinculación
 * (docs/00 §17.1: "mientras el vínculo no está aprobado, el familiar
 * no puede operar"). Solo el propio estudiante puede decidir — nunca
 * el familiar, ni siquiera sobre su propia solicitud.
 */
export async function respondFamilyLink(
  linkId: string,
  decision: "approve" | "reject",
): Promise<FamilyLinkDecisionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: link } = await admin
    .from("family_links")
    .select("id, status, student_profile_id, family_members(user_id)")
    .eq("id", linkId)
    .maybeSingle();
  if (!link || link.student_profile_id !== studentProfile.id) {
    return { status: "error", message: "No encontramos esa solicitud." };
  }
  if (link.status !== "pending_student_approval") {
    return { status: "error", message: "Esa solicitud ya fue resuelta." };
  }
  // DR32 addendum: solo se aprueba un vínculo si el familiar verificó su mail (rechazar siempre se puede).
  if (decision === "approve") {
    const familyUserId = (link.family_members as unknown as { user_id: string } | null)?.user_id;
    if (!familyUserId || !(await isFamilyEmailVerified(admin, familyUserId))) {
      return { status: "error", message: "Tu familiar todavía no verificó su mail. Pedile que ingrese el código que le mandamos y volvé a intentar." };
    }
  }

  const newStatus = decision === "approve" ? "active" : "rejected_by_student";
  const { error } = await admin
    .from("family_links")
    .update({
      status: newStatus,
      approved_at: decision === "approve" ? new Date().toISOString() : null,
    })
    .eq("id", linkId);
  if (error) {
    console.error("[family-link] update failed:", error);
    return { status: "error", message: "No pudimos guardar tu respuesta. Intentá de nuevo." };
  }

  const headerStore = await headers();
  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: decision === "approve" ? "family_link_approved" : "family_link_rejected",
    entityType: "family_links",
    entityId: linkId,
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  });

  revalidatePath("/students/dashboard");
  return { status: "idle" };
}

/** El estudiante desvincula un familiar ya activo — libera el cupo de "1 activo por estudiante" (índice único de la migración 0004). */
export async function revokeFamilyLink(linkId: string): Promise<FamilyLinkDecisionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: link } = await admin
    .from("family_links")
    .select("id, status, student_profile_id, family_members(user_id)")
    .eq("id", linkId)
    .maybeSingle();
  if (!link || link.student_profile_id !== studentProfile.id) {
    return { status: "error", message: "No encontramos ese vínculo." };
  }
  if (link.status !== "active") {
    return { status: "error", message: "Ese vínculo ya no está activo." };
  }
  const revokedFamilyUserId = (link.family_members as unknown as { user_id: string } | null)?.user_id ?? null;

  const { error } = await admin
    .from("family_links")
    .update({ status: "revoked_by_student", revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) {
    console.error("[family-link] revoke failed:", error);
    return { status: "error", message: "No pudimos desvincular. Intentá de nuevo." };
  }

  // DR4: si el ex familiar era el pagador de un fee pendiente, el pago vuelve al estudiante.
  if (revokedFamilyUserId) {
    await resetFeePayersOnLinkEnd(admin, { studentProfileId: studentProfile.id, studentUserId: sessionUser.id, familyUserId: revokedFamilyUserId });
  }

  const headerStore = await headers();
  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "family_link_revoked",
    entityType: "family_links",
    entityId: linkId,
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  });

  revalidatePath("/students/profile");
  revalidatePath("/students/dashboard");
  return { status: "idle" };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invita a un padre/tutor por email antes de que tenga cuenta —
 * inserta en `family_invitations` (migración 0034) y le manda un
 * email con el link a /register/family. No crea ningún `family_links`
 * — el familiar igual tiene que registrarse y el estudiante tiene que
 * aprobar el vínculo como ya funciona hoy (dashboard).
 */
export async function inviteFamilyMember(
  _prev: FamilyInviteState,
  formData: FormData,
): Promise<FamilyInviteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return { status: "error", message: "Ingresá un email válido." };
  }

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id, first_name")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: existingLink } = await admin
    .from("family_links")
    .select("id")
    .eq("student_profile_id", profile.id)
    .in("status", ["active", "pending_student_approval"])
    .maybeSingle();
  if (existingLink) {
    return { status: "error", message: "Ya tenés un familiar vinculado o una solicitud pendiente." };
  }

  const { data: existingInvite } = await admin
    .from("family_invitations")
    .select("id")
    .eq("student_profile_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existingInvite) {
    return { status: "error", message: "Ya enviaste una invitación — cancelala si querés invitar a otra persona." };
  }

  // Throttle: máx. 5 invitaciones por estudiante cada 24 h (incluye canceladas), para que no se use el mail como relay.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await admin
    .from("family_invitations")
    .select("id", { count: "exact", head: true })
    .eq("student_profile_id", profile.id)
    .gte("created_at", since);
  if (countError) {
    console.error("[family-invite] throttle count failed:", countError);
    return { status: "error", message: "No pudimos enviar la invitación. Intentá de nuevo." };
  }
  if ((recentCount ?? 0) >= 5) {
    return { status: "error", message: "Llegaste al máximo de invitaciones por hoy. Probá de nuevo mañana." };
  }

  const { data: invitation, error } = await admin
    .from("family_invitations")
    .insert({ student_profile_id: profile.id, email, invited_by_user_id: sessionUser.id })
    .select("id")
    .single();
  if (error) {
    console.error("[family-invite] insert failed:", error);
    return { status: "error", message: "No pudimos enviar la invitación. Intentá de nuevo." };
  }

  const appUrl = getAppUrl();
  const safeName = escapeHtml(String(profile.first_name ?? ""));
  await sendEmail({
    to: email,
    subject: `${safeSubjectName(String(profile.first_name ?? ""))} te invitó a EstuRed`,
    html: `
      <p>Hola,</p>
      <p><strong>${safeName}</strong> te invitó a sumarte a EstuRed como familiar o tutor para acompañar su búsqueda de residencia estudiantil.</p>
      <p>Una vez que crees tu cuenta, ${safeName} va a tener que aprobar el vínculo — recién ahí vas a poder ver información de su búsqueda.</p>
      <p><a href="${appUrl}/register/family">Creá tu cuenta acá</a></p>
    `,
  });

  const headerStore = await headers();
  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "family_invitation_sent",
    entityType: "family_invitations",
    entityId: invitation.id,
    newValue: { email },
    ipAddress: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  });

  revalidatePath("/students/profile");
  return { status: "sent" };
}

/** Cancela una invitación pendiente — libera el cupo para invitar a otra persona. */
export async function cancelFamilyInvitation(invitationId: string): Promise<FamilyInviteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const { data: invitation } = await admin
    .from("family_invitations")
    .select("id, student_profile_id")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation || invitation.student_profile_id !== profile.id) {
    return { status: "error", message: "No encontramos esa invitación." };
  }

  const { error } = await admin
    .from("family_invitations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) {
    console.error("[family-invite] cancel failed:", error);
    return { status: "error", message: "No pudimos cancelar la invitación. Intentá de nuevo." };
  }

  revalidatePath("/students/profile");
  return { status: "idle" };
}
