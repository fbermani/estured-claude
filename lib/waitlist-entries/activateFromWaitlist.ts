import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { ACTIVE_APPLICATION_STATUSES } from "@/lib/applications/types";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";
import { checkReservationWindowOverlap } from "@/lib/students/reservationWindow";

export type ActivateFromWaitlistResult = { ok: true; applicationId: string } | { ok: false; error: string };

/**
 * Docs/08 §6.10 ("activar solicitud") — convierte el interés pasivo de
 * la lista de espera en una solicitud de reserva real, reusando el mismo
 * helper que la propuesta del familiar aprobada (`createApplicationFromRoomType`).
 *
 * Requiere que la entrada tenga `room_type_id` (no "cualquier tipo") —
 * si el estudiante se anotó sin elegir tipo de habitación, tiene que
 * solicitar directamente desde la ficha de la residencia en vez de
 * "activar" acá; no se inventa un selector de tipo dentro de este flujo.
 */
export async function activateFromWaitlist(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string; desiredStartDate: string; durationMonths: number },
): Promise<ActivateFromWaitlistResult> {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id, academic_objective")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };
  if (!studentProfile.academic_objective) {
    return { ok: false, error: "Completá tu objetivo académico en tu perfil antes de activar la solicitud." };
  }

  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, student_profile_id, residence_id, room_type_id, status")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry || entry.student_profile_id !== studentProfile.id) {
    return { ok: false, error: "No encontramos esa entrada en tu lista de espera." };
  }
  if (!["active", "availability_notification_sent"].includes(entry.status)) {
    return { ok: false, error: "Esta entrada ya no está activa." };
  }
  if (!entry.room_type_id) {
    return { ok: false, error: "Esta entrada no tiene un tipo de habitación elegido — solicitá directamente desde la ficha de la residencia." };
  }

  const { count: activeCount } = await admin
    .from("application_requests")
    .select("*", { count: "exact", head: true })
    .eq("student_profile_id", studentProfile.id)
    .in("status", ACTIVE_APPLICATION_STATUSES);
  if ((activeCount ?? 0) >= 2) {
    return { ok: false, error: "Ya tenés 2 solicitudes activas — es el máximo permitido. Cerrá una antes de activar esta." };
  }

  const overlap = await checkReservationWindowOverlap(admin, {
    studentProfileId: studentProfile.id,
    desiredStartDate: params.desiredStartDate,
    durationMonths: params.durationMonths,
  });
  if (!overlap.ok) return { ok: false, error: overlap.error };

  const { data: roomType } = await admin
    .from("room_types")
    .select("id, monthly_price_usd, is_active, profile_availability(status)")
    .eq("id", entry.room_type_id)
    .eq("residence_id", entry.residence_id)
    .maybeSingle();
  // profile_availability tiene unique(room_type_id) — PostgREST devuelve
  // un objeto singular en el embed, no un array.
  const availability = roomType?.profile_availability as unknown as { status: string } | null;
  if (!roomType || !roomType.is_active) {
    return { ok: false, error: "Ese tipo de habitación ya no está disponible." };
  }
  if (availability?.status === "full") {
    return { ok: false, error: "Esa habitación todavía no tiene lugar." };
  }

  const result = await createApplicationFromRoomType(admin, {
    studentProfileId: studentProfile.id,
    residenceId: entry.residence_id,
    roomTypeId: entry.room_type_id,
    roomType: { monthly_price_usd: Number(roomType.monthly_price_usd) },
    desiredStartDate: params.desiredStartDate,
    durationMonths: params.durationMonths,
    academicObjective: studentProfile.academic_objective,
    initiatedBy: "student",
    contactTarget: "student",
    familyLinkId: null,
    familyProposalId: null,
    createdByUserId: params.actorUserId,
    actorRole: "student",
  });
  if ("error" in result) return { ok: false, error: result.error };

  await admin
    .from("waitlist_entries")
    .update({ status: "student_activated_request", removed_at: new Date().toISOString(), removed_by: params.actorUserId })
    .eq("id", entry.id);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "waitlist_entry_activated",
    entityType: "waitlist_entries",
    entityId: entry.id,
    newValue: { application_id: result.id },
  });

  return { ok: true, applicationId: result.id };
}
