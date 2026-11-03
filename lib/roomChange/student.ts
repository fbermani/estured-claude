import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { loadStudentByUserId } from "@/lib/stayChange/common";
import { loadActiveFamilyUserIds, loadResidenceUserIds, shortStudentName } from "@/lib/stayChange/recipients";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { roomTypeBelongsToResidence } from "@/lib/roomChange/manage";
import {
  canStudentCancelRoomChange,
  isRoomChangeStatus,
  ROOM_CHANGE_COSTS_NOTICE,
  validateRoomChangePreference,
  type RoomChangePreferenceInput,
} from "@/lib/roomChange/rules";

/**
 * Cambio de habitación (DR34): acciones del ESTUDIANTE sobre su propia estadía. Solo pide para SU estadía activa (la lee el servidor por su
 * perfil, nunca un id que venga del formulario). No se cobra nada: se deja constancia del texto de costos que reconoció.
 *
 * Menores: necesitan un familiar vinculado activo (misma regla que «Quiero cambiar»); el familiar recibe un aviso de cada paso. No se pide
 * una confirmación formal del tutor porque el pedido es dentro de la misma residencia y no cambia el contrato (supuesto reversible, DR34).
 */

export type StudentRoomChangeResult = { ok: true; message: string } | { ok: false; error: string };

const GENERIC_ERROR = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";
const NOT_AVAILABLE_ERROR = "Esta función todavía no está disponible. Probá de nuevo más tarde.";
/** Estadías que ocupan una plaza de verdad (cuenta activada). */
const OCCUPYING_STATUSES = ["active", "visibility_limited", "hidden_by_user"];

export async function createRoomChangeRequestByStudent(
  admin: SupabaseClient,
  params: { actorUserId: string; confirmed: boolean } & RoomChangePreferenceInput,
): Promise<StudentRoomChangeResult> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  if (!student) return { ok: false, error: "No encontramos tu perfil de estudiante." };
  if (!params.confirmed) return { ok: false, error: "Marcá la confirmación para poder enviar el pedido." };

  const parsed = validateRoomChangePreference(params);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const pref = parsed.value;

  const familyUserIds = await loadActiveFamilyUserIds(admin, student.id);
  if (student.is_minor && familyUserIds.length === 0) {
    return { ok: false, error: "Sos menor de edad: necesitás un familiar vinculado para pedir un cambio de habitación." };
  }

  const { data: stay, error: stayError } = await admin
    .from("resident_stays")
    .select("id, residence_id")
    .eq("student_profile_id", student.id)
    .eq("is_current", true)
    .in("status", OCCUPYING_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (stayError) {
    console.error("[roomChange] stay read failed:", stayError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!stay) return { ok: false, error: "Necesitás tener tu estadía activa para pedir un cambio de habitación." };
  const residenceId = stay.residence_id as string;

  if (pref.roomTypeId && !(await roomTypeBelongsToResidence(admin, residenceId, pref.roomTypeId))) {
    return { ok: false, error: "Ese tipo de habitación no pertenece a tu residencia." };
  }

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("room_change_requests")
    .insert({
      residence_id: residenceId,
      resident_stay_id: stay.id,
      student_profile_id: student.id,
      origin: "student",
      status: "pending",
      preferred_room_type_id: pref.roomTypeId,
      preferred_gender: pref.gender,
      preference_note: pref.note,
      reason: pref.reason,
      costs_notice_text: ROOM_CHANGE_COSTS_NOTICE,
      costs_acknowledged_at: now,
      created_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    if (error?.code === "23505") return { ok: false, error: "Ya tenés un pedido de cambio de habitación en curso." };
    if (error && isMissingSchemaError(error)) return { ok: false, error: NOT_AVAILABLE_ERROR };
    console.error("[roomChange] insert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const requestId = inserted.id as string;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "room_change_requested",
    entityType: "room_change_requests",
    entityId: requestId,
    newValue: {
      origin: "student",
      residence_id: residenceId,
      preferred_room_type_id: pref.roomTypeId,
      preferred_gender: pref.gender,
    },
  });

  const name = shortStudentName(student);
  await notifyResidenceTeam(admin, { residenceId, event: "new_room_change_request", entityId: requestId });
  await createNotification(admin, {
    userId: params.actorUserId,
    title: "Enviamos tu pedido de cambio de habitación",
    body: "Tu residencia lo ve en Residentes. Está sujeto a disponibilidad y, si se concreta, a los costos que correspondan, que te informa la residencia. Podés cancelarlo cuando quieras.",
    relatedEntityType: "room_change_requests",
    relatedEntityId: requestId,
  });
  for (const userId of familyUserIds) {
    await createNotification(admin, {
      userId,
      title: `${name} pidió cambiar de habitación`,
      body: "Lo pidió a su residencia actual. Está sujeto a disponibilidad y a los costos que correspondan. No cambia su contrato ni su reserva.",
      relatedEntityType: "room_change_requests",
      relatedEntityId: requestId,
    });
  }
  return { ok: true, message: "Le mandamos tu pedido a tu residencia. Queda sujeto a disponibilidad." };
}

export async function cancelRoomChangeRequestByStudent(
  admin: SupabaseClient,
  params: { actorUserId: string; requestId: string },
): Promise<StudentRoomChangeResult> {
  const student = await loadStudentByUserId(admin, params.actorUserId);
  if (!student) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data, error: readError } = await admin
    .from("room_change_requests")
    .select("id, residence_id, student_profile_id, status")
    .eq("id", params.requestId)
    .maybeSingle();
  if (readError) {
    if (isMissingSchemaError(readError)) return { ok: false, error: NOT_AVAILABLE_ERROR };
    console.error("[roomChange] cancel read failed:", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  const row = data as { id: string; residence_id: string; student_profile_id: string | null; status: string } | null;
  // Solo el pedido propio: un id ajeno responde igual que uno inexistente.
  if (!row || row.student_profile_id !== student.id) return { ok: false, error: "No encontramos ese pedido." };
  if (!isRoomChangeStatus(row.status) || !canStudentCancelRoomChange(row.status)) return { ok: false, error: "Ese pedido ya está cerrado." };

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("room_change_requests")
    .update({
      status: "cancelled",
      closed_reason: "cancelled_by_student",
      resolved_at: now,
      offered_bed_id: null,
      offered_label: null,
      offered_at: null,
    })
    .eq("id", row.id)
    .eq("student_profile_id", student.id)
    .in("status", ["pending", "offered"])
    .select("id");
  if (error || !updated || updated.length === 0) {
    if (error) console.error("[roomChange] cancel failed:", error);
    return { ok: false, error: error ? GENERIC_ERROR : "Ese pedido ya está cerrado." };
  }

  // Si la residencia le había ofrecido una plaza, esa plaza vuelve a quedar por decidir.
  const { error: alertError } = await admin
    .from("room_change_place_alerts")
    .update({ status: "pending", offered_request_id: null })
    .eq("residence_id", row.residence_id)
    .eq("offered_request_id", row.id)
    .eq("status", "offered");
  if (alertError && !isMissingSchemaError(alertError)) console.error("[roomChange] release alert on cancel failed:", alertError);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "room_change_cancelled_by_student",
    entityType: "room_change_requests",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { status: "cancelled" },
  });

  const name = shortStudentName(student);
  for (const userId of await loadResidenceUserIds(admin, row.residence_id, "residents.manage")) {
    await createNotification(admin, {
      userId,
      title: `${name} canceló su pedido de cambio de habitación`,
      body: "Ya no está buscando cambiar. Si le habías ofrecido una plaza, volvió a quedar por decidir en Residentes.",
      relatedEntityType: "room_change_requests",
      relatedEntityId: row.id,
    });
  }
  for (const userId of await loadActiveFamilyUserIds(admin, student.id)) {
    await createNotification(admin, {
      userId,
      title: `${name} canceló su pedido de cambio de habitación`,
      body: "Su pedido a la residencia quedó cancelado.",
      relatedEntityType: "room_change_requests",
      relatedEntityId: row.id,
    });
  }
  return { ok: true, message: "Cancelaste tu pedido de cambio de habitación." };
}
