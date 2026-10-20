import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";

export type ActivateResidentStayResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/05 §15.1 — "El residente debe activar cuenta y completar
 * registro para mostrar perfil ampliado." El estudiante vincula una
 * estadía que la residencia cargó con su email a su propia cuenta.
 * Pasa a `active` directo — respeta el default privado de
 * `student_visibility_settings` (todos los campos individuales en
 * `false` salvo que el estudiante los haya habilitado), así que
 * "activo" no implica exponer datos, solo dejar de aparecer como
 * "pendiente de activar cuenta".
 */
export async function activateResidentStay(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId: string },
): Promise<ActivateResidentStayResult> {
  const { data: user } = await admin.from("users").select("email").eq("id", params.actorUserId).maybeSingle();
  if (!user) return { ok: false, error: "No encontramos tu usuario." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, invite_email, student_profile_id, status, residence_id")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "No encontramos esa invitación." };
  if (stay.student_profile_id) return { ok: false, error: "Esa invitación ya fue activada." };
  if (stay.invite_email?.toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, error: "Esa invitación no corresponde a tu email." };
  }

  const { error } = await admin
    .from("resident_stays")
    .update({ student_profile_id: studentProfile.id, status: "active" })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] activateResidentStay update failed:", error);
    return { ok: false, error: "No pudimos activar tu estadía. Intentá de nuevo." };
  }

  // Si la residencia lo dio de alta antes de que existiera la cuenta (o la
  // reserva), este es el momento de completar el vínculo con la reserva.
  await linkStayToReservationIfMissing(admin, {
    residentStayId: params.residentStayId,
    residenceId: stay.residence_id,
    studentProfileId: studentProfile.id,
  });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "resident_stay_activated",
    entityType: "resident_stays",
    entityId: params.residentStayId,
  });

  return { ok: true };
}
