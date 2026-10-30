import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { findLinkableReservationIdByEmail } from "@/lib/residents/linkReservation";
import { issueResidentInvite } from "@/lib/residents/residentInvitations";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Vincular después (DR18 t4, punto 20) y corregir el mail (DR19): a un residente cargado sin mail se le carga el mail cuando la residencia
 * lo tiene, y si el mail estaba mal se puede cambiar mientras NO haya cuenta vinculada. Cambiarlo invalida el enlace personal anterior y
 * manda uno nuevo al mail nuevo (la persona activa con ese enlace o con un código a ese mail: `activateResidentStay`). Solo estadías vigentes
 * sin cuenta vinculada; permiso `residents.manage`; el mail no puede estar en otra estadía vigente de la residencia.
 */
export async function setResidentEmail(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; residentStayId: string; email: string },
): Promise<{ ok: true; emailSent: boolean } | { ok: false; error: string }> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };

  const email = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Ingresá un email válido." };

  const { data: stay, error: stayError } = await admin
    .from("resident_stays")
    .select("id, invite_email, student_profile_id, is_current")
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (stayError) {
    console.error("[residents] setResidentEmail stay read failed:", stayError);
    return { ok: false, error: "No pudimos guardar el mail. Intentá de nuevo." };
  }
  if (!stay) return { ok: false, error: "Ese residente no pertenece a esta residencia." };
  if (!stay.is_current || stay.student_profile_id) {
    return { ok: false, error: "A este residente no se le puede cambiar el mail: ya tiene cuenta vinculada o su estadía terminó." };
  }
  if (stay.invite_email && String(stay.invite_email).toLowerCase() === email) return { ok: false, error: "Ese ya es el mail cargado." };

  const { data: dup, error: dupError } = await admin
    .from("resident_stays")
    .select("id")
    .eq("residence_id", params.residenceId)
    .eq("invite_email", email)
    .eq("is_current", true)
    .maybeSingle();
  if (dupError) {
    console.error("[residents] setResidentEmail dup check failed:", dupError);
    return { ok: false, error: "No pudimos guardar el mail. Intentá de nuevo." };
  }
  if (dup) return { ok: false, error: "Ya hay una estadía activa cargada con ese email en esta residencia." };

  let reservationId: string | null = null;
  try {
    reservationId = await findLinkableReservationIdByEmail(admin, { residenceId: params.residenceId, email });
  } catch (linkError) {
    console.error("[residents] setResidentEmail auto-link failed:", linkError);
  }

  const previousEmail = (stay.invite_email as string | null) ?? null;
  let update = admin
    .from("resident_stays")
    .update({ invite_email: email, ...(reservationId ? { reservation_id: reservationId } : {}) })
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .is("student_profile_id", null);
  update = previousEmail ? update.eq("invite_email", previousEmail) : update.is("invite_email", null);
  const { data: updated, error } = await update.select("id");
  if (error) {
    console.error("[residents] setResidentEmail failed:", error);
    return { ok: false, error: error.code === "23505" ? "Ya hay una estadía activa cargada con ese email en esta residencia." : "No pudimos guardar el mail. Intentá de nuevo." };
  }
  if (!updated || updated.length === 0) return { ok: false, error: "Este residente cambió mientras tanto. Recargá la página y probá de nuevo." };

  // El enlace anterior pertenecía al mail viejo: se invalida (y también lo que haya de código verificado).
  const revoked = await admin
    .from("resident_stay_invitations")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: "email_changed" })
    .eq("resident_stay_id", params.residentStayId)
    .is("used_at", null)
    .is("revoked_at", null);
  if (revoked.error && !isMissingSchemaError(revoked.error)) console.error("[residents] setResidentEmail revoke failed:", revoked.error);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: previousEmail ? "resident_stay_email_changed" : "resident_stay_email_set",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    // PII mínima: se registra que se cargó un mail, no el mail.
    newValue: { permission: access.permission, residence_id: params.residenceId, has_email: true },
  });

  const invite = await issueResidentInvite(admin, {
    actorUserId: params.actorUserId,
    residenceId: params.residenceId,
    residentStayId: params.residentStayId,
    channel: "email",
    skipCooldown: true,
  });
  return { ok: true, emailSent: invite.ok && invite.emailSent };
}
