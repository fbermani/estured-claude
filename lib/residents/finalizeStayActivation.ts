import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { INVITE_STATE_MESSAGES } from "@/lib/residents/inviteRules";
import { linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Vincula de verdad la estadía (paso final de DR19): update condicional (si otra pestaña/persona la vinculó mientras tanto, no se pisa),
 * invitación usada, vínculo a la reserva y auditoría. Lo usa la activación directa y la confirmación del tutor de un menor (DR32).
 */
export async function finalizeStayActivation(
  admin: SupabaseClient,
  params: { stay: { id: string; residence_id: string }; invitationId: string; studentProfileId: string; actorUserId: string; via: string; now: Date },
): Promise<{ ok: true } | { ok: false; error: string; conflict: boolean }> {
  const { stay, invitationId, studentProfileId, now } = params;
  const link = { student_profile_id: studentProfileId, status: "active" };
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
    return { ok: false, error: "No pudimos activar tu estadía. Intentá de nuevo.", conflict: false };
  }
  if (!updated || updated.length === 0) return { ok: false, error: INVITE_STATE_MESSAGES.used, conflict: true };

  const { error: usedError } = await admin
    .from("resident_stay_invitations")
    .update({ used_at: now.toISOString(), used_by_user_id: params.actorUserId })
    .eq("id", invitationId);
  if (usedError) console.error("[residents] activateResidentStay mark used failed:", usedError);

  // Si la residencia lo dio de alta antes de que existiera la cuenta (o la reserva), este es el momento de completar el vínculo.
  await linkStayToReservationIfMissing(admin, { residentStayId: stay.id, residenceId: stay.residence_id, studentProfileId });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "resident_stay_activated",
    entityType: "resident_stays",
    entityId: stay.id,
    newValue: { via: params.via },
  });
  return { ok: true };
}
