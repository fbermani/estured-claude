import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sendEmail";
import { loadActiveFamilyLink } from "@/lib/family/access";
import { formatShortName } from "@/lib/format/shortName";
import { createNotification } from "@/lib/notifications/createNotification";
import { finalizeStayActivation } from "@/lib/residents/finalizeStayActivation";
import { linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";
import { checkStudentCanLink } from "@/lib/residents/studentLinkGuards";
import {
  computeGuardianExpiry,
  GUARDIAN_COPY,
  GUARDIAN_ERRORS,
  guardianNeedsReminder,
  isGuardianConfirmationExpired,
  type GuardianConfirmationOrigin,
} from "@/lib/residents/guardianConfirmationRules";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { loadActiveFamilyUserIds } from "@/lib/stayChange/recipients";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * Confirmación del tutor para la estadía de un menor (DR32, migración 0071). Mientras está `pending` NO se vincula nada: la estadía sigue
 * sin `student_profile_id`. Todo con service role y filtros explícitos; las acciones validan sesión y vínculo ACTIVO antes de llamar acá.
 */

const COLUMNS = "id, student_profile_id, residence_id, origin, resident_stay_id, invitation_id, link_request_id, residence_actor_user_id, status, requested_at, expires_at, reminded_at";
export type GuardianConfirmationRow = {
  id: string;
  student_profile_id: string;
  residence_id: string;
  origin: GuardianConfirmationOrigin;
  resident_stay_id: string | null;
  invitation_id: string | null;
  link_request_id: string | null;
  residence_actor_user_id: string | null;
  status: string;
  requested_at: string;
  expires_at: string;
  reminded_at: string | null;
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function loadNames(admin: SupabaseClient, studentProfileId: string, residenceId: string) {
  const [{ data: student }, { data: residence }] = await Promise.all([
    admin.from("student_profiles").select("first_name, last_initial, user_id").eq("id", studentProfileId).maybeSingle(),
    admin.from("residences").select("name").eq("id", residenceId).maybeSingle(),
  ]);
  const s = student as { first_name?: string; last_initial?: string | null; user_id?: string } | null;
  return {
    studentName: s?.first_name ? formatShortName(s.first_name, s.last_initial ?? null) : "Tu familiar menor",
    studentUserId: s?.user_id ?? null,
    residenceName: (residence as { name?: string } | null)?.name ?? "la residencia",
  };
}

/** In-app siempre; mail solo con dominio verificado (el remitente sandbox de Resend no entrega a destinatarios reales). */
async function notifyGuardians(admin: SupabaseClient, studentProfileId: string, entry: { title: string; body: string }, confirmationId: string): Promise<void> {
  try {
    const userIds = await loadActiveFamilyUserIds(admin, studentProfileId);
    for (const userId of userIds) {
      await createNotification(admin, { userId, ...entry, relatedEntityType: "guardian_stay_confirmations", relatedEntityId: confirmationId, category: "requests_reservations" });
      if (process.env.EMAIL_DOMAIN_VERIFIED !== "true") continue;
      const { data: user } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
      const email = (user as { email?: string } | null)?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: entry.title.replace(/[\r\n]/g, " "),
        html: `<p>${escapeHtml(entry.body)}</p><p><a href="${SITE_URL}/students/dashboard">Abrir EstuRed</a></p>`,
      });
    }
  } catch (error) {
    console.error("[guardian] notifyGuardians failed:", error);
  }
}

/**
 * Origen `residence_approval`: la solicitud de vínculo quedó `approved` al pedir la confirmación. Si el tutor rechaza, vence o se cancela,
 * pasa a `rejected` (estado ya definido en docs/04 §16.4) para que el menor pueda volver a pedirla; la residencia no recibe aviso (DR32).
 */
async function closeLinkRequestOf(admin: SupabaseClient, row: { link_request_id: string | null }, now: Date): Promise<void> {
  if (!row.link_request_id) return;
  const { error } = await admin
    .from("resident_link_requests")
    .update({ status: "rejected", resolved_at: now.toISOString(), resolution_note: "El familiar no confirmó la estadía." })
    .eq("id", row.link_request_id)
    .eq("status", "approved")
    .is("matched_stay_id", null);
  if (error) console.error("[guardian] close link request failed:", error);
}

/** Confirmación pendiente (vigente o no) del estudiante, o `null`. Degrada a `null` si la migración 0071 no está aplicada. */
export async function loadPendingConfirmationOfStudent(admin: SupabaseClient, studentProfileId: string): Promise<GuardianConfirmationRow | null> {
  const { data, error } = await admin
    .from("guardian_stay_confirmations")
    .select(COLUMNS)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[guardian] pending read failed:", error);
    return null;
  }
  return (data as GuardianConfirmationRow | null) ?? null;
}

export async function requestGuardianConfirmation(
  admin: SupabaseClient,
  params: {
    origin: GuardianConfirmationOrigin;
    studentProfileId: string;
    studentUserId: string | null;
    residenceId: string;
    residentStayId: string | null;
    invitationId?: string | null;
    linkRequestId?: string | null;
    residenceActorUserId?: string | null;
    now?: Date;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = params.now ?? new Date();
  const existing = await loadPendingConfirmationOfStudent(admin, params.studentProfileId);
  if (existing && !isGuardianConfirmationExpired(existing, now)) return { ok: false, error: GUARDIAN_ERRORS.alreadyPending };
  if (existing) {
    const { error: expireError } = await admin.from("guardian_stay_confirmations").update({ status: "expired", resolved_at: now.toISOString() }).eq("id", existing.id).eq("status", "pending");
    if (expireError) {
      console.error("[guardian] expire previous failed:", expireError);
      return { ok: false, error: GUARDIAN_ERRORS.generic };
    }
    await closeLinkRequestOf(admin, existing, now);
  }

  const { data, error } = await admin
    .from("guardian_stay_confirmations")
    .insert({
      student_profile_id: params.studentProfileId,
      residence_id: params.residenceId,
      origin: params.origin,
      resident_stay_id: params.residentStayId,
      invitation_id: params.invitationId ?? null,
      link_request_id: params.linkRequestId ?? null,
      residence_actor_user_id: params.residenceActorUserId ?? null,
      status: "pending",
      requested_at: now.toISOString(),
      expires_at: computeGuardianExpiry(now).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error && isMissingSchemaError(error)) return { ok: false, error: GUARDIAN_ERRORS.unavailable };
    if (error?.code === "23505") return { ok: false, error: GUARDIAN_ERRORS.alreadyPending };
    console.error("[guardian] insert failed:", error);
    return { ok: false, error: GUARDIAN_ERRORS.generic };
  }
  const id = (data as { id: string }).id;
  const names = await loadNames(admin, params.studentProfileId, params.residenceId);

  await notifyGuardians(admin, params.studentProfileId, GUARDIAN_COPY.requestedForGuardian(names.studentName, names.residenceName), id);
  if (names.studentUserId) {
    await createNotification(admin, { userId: names.studentUserId, ...GUARDIAN_COPY.requestedForStudent(names.residenceName), relatedEntityType: "resident_stays" });
  }
  await createAuditLog(admin, {
    actorUserId: params.origin === "residence_approval" ? (params.residenceActorUserId ?? null) : params.studentUserId,
    actorRole: params.origin === "residence_approval" ? "residence" : "student",
    action: "guardian_confirmation_requested",
    entityType: "guardian_stay_confirmations",
    entityId: id,
    newValue: { origin: params.origin, residence_id: params.residenceId },
  });
  return { ok: true, id };
}

/** Vincula la estadía aprobada por la residencia (origen `residence_approval`): une la estadía cargada o crea una `active`. */
async function linkApprovedStay(admin: SupabaseClient, row: GuardianConfirmationRow): Promise<{ ok: true; stayId: string } | { ok: false; error: string; conflict: boolean }> {
  const profile = { student_profile_id: row.student_profile_id, status: "active" };
  if (row.resident_stay_id) {
    let { data: linked, error } = await admin
      .from("resident_stays")
      .update({ ...profile, invite_phone: null })
      .eq("id", row.resident_stay_id)
      .eq("residence_id", row.residence_id)
      .eq("is_current", true)
      .is("student_profile_id", null)
      .select("id");
    if (error && isMissingSchemaError(error)) {
      ({ data: linked, error } = await admin.from("resident_stays").update(profile).eq("id", row.resident_stay_id).eq("residence_id", row.residence_id).eq("is_current", true).is("student_profile_id", null).select("id"));
    }
    if (error) {
      console.error("[guardian] link stay failed:", error);
      return { ok: false, error: GUARDIAN_ERRORS.generic, conflict: false };
    }
    if (!linked || linked.length === 0) return { ok: false, error: GUARDIAN_ERRORS.changed, conflict: true };
    await admin
      .from("resident_stay_invitations")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: "linked_by_residence" })
      .eq("resident_stay_id", row.resident_stay_id)
      .is("used_at", null)
      .is("revoked_at", null);
    return { ok: true, stayId: row.resident_stay_id };
  }
  const { data: created, error } = await admin
    .from("resident_stays")
    .insert({ residence_id: row.residence_id, student_profile_id: row.student_profile_id, created_by_residence_user_id: row.residence_actor_user_id, status: "active" })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[guardian] create stay failed:", error);
    return { ok: false, error: GUARDIAN_ERRORS.generic, conflict: false };
  }
  return { ok: true, stayId: (created as { id: string }).id };
}

export type ResolveGuardianResult = { ok: true } | { ok: false; error: string };

/**
 * El tutor confirma o rechaza. Valida server-side: la confirmación existe y está `pending` y vigente, y quien llama tiene vínculo
 * ACTIVO con ese estudiante (`loadActiveFamilyLink`). Al confirmar revalida las condiciones de DR19 antes de vincular.
 */
export async function resolveGuardianConfirmation(
  admin: SupabaseClient,
  params: { actorUserId: string; confirmationId: string; decision: "confirm" | "reject"; now?: Date },
): Promise<ResolveGuardianResult> {
  const now = params.now ?? new Date();
  const { data, error } = await admin.from("guardian_stay_confirmations").select(COLUMNS).eq("id", params.confirmationId).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, error: GUARDIAN_ERRORS.unavailable };
    console.error("[guardian] read failed:", error);
    return { ok: false, error: GUARDIAN_ERRORS.generic };
  }
  const row = data as GuardianConfirmationRow | null;
  // Misma respuesta si no existe o no es del tutor: no confirma la existencia de pedidos ajenos.
  if (!row) return { ok: false, error: GUARDIAN_ERRORS.notFound };
  const link = await loadActiveFamilyLink(admin, params.actorUserId, row.student_profile_id);
  if (!link) return { ok: false, error: GUARDIAN_ERRORS.notFound };
  if (row.status !== "pending" || isGuardianConfirmationExpired(row, now)) return { ok: false, error: GUARDIAN_ERRORS.alreadyResolved };

  const names = await loadNames(admin, row.student_profile_id, row.residence_id);
  const resolvedAt = now.toISOString();
  const close = async (status: "confirmed" | "rejected" | "cancelled") => {
    const { data: claimed } = await admin
      .from("guardian_stay_confirmations")
      .update({ status, resolved_at: resolvedAt, resolved_by_user_id: params.actorUserId })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    return !!claimed && claimed.length > 0;
  };

  if (params.decision === "reject") {
    if (!(await close("rejected"))) return { ok: false, error: GUARDIAN_ERRORS.alreadyResolved };
    await closeLinkRequestOf(admin, row, now);
    if (names.studentUserId) await createNotification(admin, { userId: names.studentUserId, ...GUARDIAN_COPY.rejectedForStudent(names.residenceName), relatedEntityType: "resident_stays", category: "requests_reservations" });
    await createAuditLog(admin, { actorUserId: params.actorUserId, actorRole: "family_member", action: "guardian_confirmation_rejected", entityType: "guardian_stay_confirmations", entityId: row.id });
    return { ok: true };
  }

  // ---- Confirmar: revalidar antes de vincular ----
  const cancel = async (): Promise<ResolveGuardianResult> => {
    await close("cancelled");
    await closeLinkRequestOf(admin, row, now);
    return { ok: false, error: GUARDIAN_ERRORS.changed };
  };
  const guard = await checkStudentCanLink(admin, row.student_profile_id);
  if (!guard.ok) return cancel();

  type InviteLite = { id: string; used_at: string | null; revoked_at: string | null; declined_at: string | null };
  type StayLite = { id: string; residence_id: string; is_current: boolean; student_profile_id: string | null };
  let invite = null as InviteLite | null;
  let stay = null as StayLite | null;
  if (row.origin === "invite") {
    if (!row.resident_stay_id || !row.invitation_id) return cancel();
    const [{ data: i }, { data: s }] = await Promise.all([
      admin.from("resident_stay_invitations").select("id, used_at, revoked_at, declined_at").eq("id", row.invitation_id).eq("resident_stay_id", row.resident_stay_id).maybeSingle(),
      admin.from("resident_stays").select("id, residence_id, is_current, student_profile_id").eq("id", row.resident_stay_id).maybeSingle(),
    ]);
    invite = i as InviteLite | null;
    stay = s as StayLite | null;
    // La prueba de identidad ya se hizo al pedir; el vencimiento del enlace no importa, sí que no lo hayan usado, revocado o rechazado.
    if (!invite || !stay || stay.residence_id !== row.residence_id || !stay.is_current || stay.student_profile_id || invite.used_at || invite.revoked_at || invite.declined_at) return cancel();
  }

  if (!(await close("confirmed"))) return { ok: false, error: GUARDIAN_ERRORS.alreadyResolved };

  // Si el vínculo falla desde acá, se deja constancia y el tutor/menor pueden reintentar: `confirmed` → de nuevo `pending` solo ante error transitorio.
  const reopen = async () => {
    const { error: reopenError } = await admin.from("guardian_stay_confirmations").update({ status: "pending", resolved_at: null, resolved_by_user_id: null }).eq("id", row.id).eq("status", "confirmed");
    // Si otro pedido ocupó el lugar (índice único) o falla, queda cancelada: nunca `confirmed` sin estadía.
    if (reopenError) {
      await admin.from("guardian_stay_confirmations").update({ status: "cancelled" }).eq("id", row.id);
      await closeLinkRequestOf(admin, row, now);
    }
  };
  if (row.origin === "invite" && invite && stay) {
    const done = await finalizeStayActivation(admin, {
      stay,
      invitationId: invite.id,
      studentProfileId: row.student_profile_id,
      actorUserId: names.studentUserId ?? params.actorUserId,
      via: "guardian_confirmed",
      now,
    });
    if (!done.ok) {
      if (done.conflict) {
        await admin.from("guardian_stay_confirmations").update({ status: "cancelled" }).eq("id", row.id);
        await closeLinkRequestOf(admin, row, now);
        return { ok: false, error: GUARDIAN_ERRORS.changed };
      }
      await reopen();
      return { ok: false, error: GUARDIAN_ERRORS.generic };
    }
  } else {
    const linked = await linkApprovedStay(admin, row);
    if (!linked.ok) {
      if (linked.conflict) {
        await admin.from("guardian_stay_confirmations").update({ status: "cancelled" }).eq("id", row.id);
        await closeLinkRequestOf(admin, row, now);
      } else {
        await reopen();
      }
      return { ok: false, error: linked.error };
    }
    if (row.link_request_id) await admin.from("resident_link_requests").update({ matched_stay_id: linked.stayId }).eq("id", row.link_request_id);
    await linkStayToReservationIfMissing(admin, { residentStayId: linked.stayId, residenceId: row.residence_id, studentProfileId: row.student_profile_id });
  }

  if (names.studentUserId) await createNotification(admin, { userId: names.studentUserId, ...GUARDIAN_COPY.confirmedForStudent(names.residenceName), relatedEntityType: "resident_stays", relatedEntityId: row.resident_stay_id ?? undefined, category: "requests_reservations" });
  await createAuditLog(admin, { actorUserId: params.actorUserId, actorRole: "family_member", action: "guardian_confirmation_confirmed", entityType: "guardian_stay_confirmations", entityId: row.id });
  return { ok: true };
}

/** Cron horario: vence las confirmaciones a los 7 días (avisa al menor y al tutor) y manda UN recordatorio a los 3. Best-effort: nunca lanza. */
export async function runGuardianConfirmationJob(admin: SupabaseClient, now: Date = new Date()): Promise<{ expired: number; reminded: number }> {
  const result = { expired: 0, reminded: 0 };
  try {
    const { data, error } = await admin.from("guardian_stay_confirmations").select(COLUMNS).eq("status", "pending").limit(200);
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[jobs] guardianConfirmations query falló:", error);
      return result;
    }
    for (const row of (data ?? []) as GuardianConfirmationRow[]) {
      if (isGuardianConfirmationExpired(row, now)) {
        const { data: claimed } = await admin.from("guardian_stay_confirmations").update({ status: "expired", resolved_at: now.toISOString() }).eq("id", row.id).eq("status", "pending").select("id");
        if (!claimed || claimed.length === 0) continue;
        await closeLinkRequestOf(admin, row, now);
        const names = await loadNames(admin, row.student_profile_id, row.residence_id);
        if (names.studentUserId) await createNotification(admin, { userId: names.studentUserId, ...GUARDIAN_COPY.expiredForStudent(names.residenceName), relatedEntityType: "resident_stays", category: "deadlines" });
        await notifyGuardians(admin, row.student_profile_id, GUARDIAN_COPY.expiredForGuardian(names.studentName, names.residenceName), row.id);
        result.expired += 1;
      } else if (guardianNeedsReminder(row, now)) {
        // Se marca ANTES de avisar: si el aviso falla no se repite cada hora.
        const { data: claimed } = await admin.from("guardian_stay_confirmations").update({ reminded_at: now.toISOString() }).eq("id", row.id).eq("status", "pending").is("reminded_at", null).select("id");
        if (!claimed || claimed.length === 0) continue;
        const names = await loadNames(admin, row.student_profile_id, row.residence_id);
        await notifyGuardians(admin, row.student_profile_id, GUARDIAN_COPY.reminderForGuardian(names.studentName, names.residenceName), row.id);
        result.reminded += 1;
      }
    }
  } catch (error) {
    console.error("[jobs] guardianConfirmations falló:", error);
  }
  return result;
}

export type GuardianPendingCard = { id: string; studentName: string; residenceName: string; expiresAt: string };

/** Pedidos pendientes y vigentes de los estudiantes con los que el familiar tiene vínculo ACTIVO. Nombre corto + residencia y nada más (DR32). */
export async function loadPendingForGuardian(admin: SupabaseClient, familyUserId: string, now: Date = new Date()): Promise<GuardianPendingCard[]> {
  const { data: links, error } = await admin
    .from("family_links")
    .select("student_profile_id, family_members!inner(user_id)")
    .eq("status", "active")
    .eq("family_members.user_id", familyUserId);
  if (error) {
    console.error("[guardian] links read failed:", error);
    return [];
  }
  const studentIds = ((links ?? []) as { student_profile_id: string }[]).map((l) => l.student_profile_id);
  if (studentIds.length === 0) return [];
  const { data: rows, error: rowsError } = await admin
    .from("guardian_stay_confirmations")
    .select("id, student_profile_id, residence_id, expires_at")
    .in("student_profile_id", studentIds)
    .eq("status", "pending")
    .gt("expires_at", now.toISOString());
  if (rowsError) {
    if (!isMissingSchemaError(rowsError)) console.error("[guardian] pending read failed:", rowsError);
    return [];
  }
  const cards: GuardianPendingCard[] = [];
  for (const r of (rows ?? []) as { id: string; student_profile_id: string; residence_id: string; expires_at: string }[]) {
    const names = await loadNames(admin, r.student_profile_id, r.residence_id);
    cards.push({ id: r.id, studentName: names.studentName, residenceName: names.residenceName, expiresAt: r.expires_at });
  }
  return cards;
}
