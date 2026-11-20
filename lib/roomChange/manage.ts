import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { incrementAvailabilityOnRelease } from "@/lib/availability/incrementAvailabilityOnRelease";
import { createNotification } from "@/lib/notifications/createNotification";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import {
  canResidenceMoveRoomChange,
  isRoomChangeStatus,
  validateRoomChangePreference,
  type PlaceAlertDecision,
  type RoomChangePreferenceInput,
  type RoomChangeStatus,
} from "@/lib/roomChange/rules";

/**
 * Cambio de habitación (DR34): acciones del EQUIPO de la residencia. Toda la autorización es server-side con `assertResidencePermission`:
 *  - `residents.manage`: anotar / editar el pedido de un residente, pasarlo a «en gestión», resolverlo o cancelarlo, y decidir qué hacer con una
 *    plaza liberada (ofrecérsela a un residente o ignorarla).
 *  - `operations.rooms_availability`: publicar la plaza como disponible (toca la disponibilidad, que es de «Habitaciones y disponibilidad», DR11).
 * No se cobra nada ni se promete disponibilidad: es un registro interno y un aviso al residente.
 */

export type RoomChangeResult = { ok: true; message?: string } | { ok: false; error: string };

const GENERIC_ERROR = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";
const NOT_AVAILABLE_ERROR = "Esta función todavía no está disponible. Probá de nuevo más tarde.";
const NOT_FOUND_ERROR = "No encontramos ese pedido de cambio de habitación.";
const OPEN = ["pending", "offered"];

type RequestRow = {
  id: string;
  residence_id: string;
  resident_stay_id: string;
  student_profile_id: string | null;
  status: string;
  origin: string;
  offered_bed_id: string | null;
};

const REQUEST_COLUMNS = "id, residence_id, resident_stay_id, student_profile_id, status, origin, offered_bed_id";

async function loadRequest(admin: SupabaseClient, requestId: string): Promise<{ row: RequestRow | null; failed: boolean; missing: boolean }> {
  const { data, error } = await admin.from("room_change_requests").select(REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[roomChange] request read failed:", error);
    return { row: null, failed: true, missing: isMissingSchemaError(error) };
  }
  return { row: (data as RequestRow | null) ?? null, failed: false, missing: false };
}

/** El tipo de habitación elegido tiene que ser de ESTA residencia y estar activo. */
export async function roomTypeBelongsToResidence(admin: SupabaseClient, residenceId: string, roomTypeId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("room_types")
    .select("id")
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) console.error("[roomChange] room type read failed:", error);
  return !!data;
}

async function notifyStudent(admin: SupabaseClient, studentProfileId: string | null, requestId: string, entry: { title: string; body: string }): Promise<void> {
  if (!studentProfileId) return;
  const { data } = await admin.from("student_profiles").select("user_id").eq("id", studentProfileId).maybeSingle();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) return;
  await createNotification(admin, { userId, ...entry, relatedEntityType: "room_change_requests", relatedEntityId: requestId, category: "requests_reservations" });
}

/** Devuelve a «por decidir» los avisos de plaza que estaban ofrecidos a este pedido (o los cierra si el residente ya se mudó). */
async function releaseOfferedAlerts(admin: SupabaseClient, residenceId: string, requestId: string, next: "pending" | "resolved", actorUserId: string): Promise<void> {
  const patch =
    next === "pending"
      ? { status: "pending", offered_request_id: null }
      : { status: "resolved", resolved_at: new Date().toISOString(), resolved_by_user_id: actorUserId };
  const { error } = await admin
    .from("room_change_place_alerts")
    .update(patch)
    .eq("residence_id", residenceId)
    .eq("offered_request_id", requestId)
    .eq("status", "offered");
  if (error && !isMissingSchemaError(error)) console.error("[roomChange] release alerts failed:", error);
}

/**
 * «Solicita cambio de habitación» desde la ficha del residente: crea el pedido (origen `residence`) o, si ya hay uno abierto, actualiza su
 * preferencia. Campos: tipo, género, nota (piso / texto libre) y motivo.
 */
export async function saveRoomChangeRequestByResidence(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; residentStayId: string } & RoomChangePreferenceInput,
): Promise<RoomChangeResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = validateRoomChangePreference(params);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const pref = parsed.value;

  const { data: stay, error: stayError } = await admin
    .from("resident_stays")
    .select("id, residence_id, is_current, student_profile_id")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (stayError) {
    console.error("[roomChange] stay read failed:", stayError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!stay || stay.residence_id !== params.residenceId || !stay.is_current) {
    return { ok: false, error: "Esa estadía no está activa en esta residencia." };
  }
  if (pref.roomTypeId && !(await roomTypeBelongsToResidence(admin, params.residenceId, pref.roomTypeId))) {
    return { ok: false, error: "Ese tipo de habitación no pertenece a esta residencia." };
  }

  const fields = {
    preferred_room_type_id: pref.roomTypeId,
    preferred_gender: pref.gender,
    preference_note: pref.note,
    reason: pref.reason,
  };

  const { data: existing, error: existingError } = await admin
    .from("room_change_requests")
    .select("id")
    .eq("resident_stay_id", params.residentStayId)
    .in("status", OPEN)
    .maybeSingle();
  if (existingError) {
    if (isMissingSchemaError(existingError)) return { ok: false, error: NOT_AVAILABLE_ERROR };
    console.error("[roomChange] existing read failed:", existingError);
    return { ok: false, error: GENERIC_ERROR };
  }

  if (existing) {
    const { data: updated, error } = await admin
      .from("room_change_requests")
      .update(fields)
      .eq("id", existing.id)
      .eq("residence_id", params.residenceId)
      .in("status", OPEN)
      .select("id");
    if (error || !updated || updated.length === 0) {
      if (error) console.error("[roomChange] update failed:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "room_change_updated",
      entityType: "room_change_requests",
      entityId: existing.id as string,
      newValue: { permission: access.permission, ...fields },
    });
    return { ok: true, message: "Actualizamos la preferencia." };
  }

  const { data: inserted, error } = await admin
    .from("room_change_requests")
    .insert({
      residence_id: params.residenceId,
      resident_stay_id: params.residentStayId,
      student_profile_id: (stay.student_profile_id as string | null) ?? null,
      origin: "residence",
      status: "pending",
      ...fields,
      created_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    if (error?.code === "23505") return { ok: false, error: "Este residente ya tiene un pedido de cambio en curso. Recargá la pantalla." };
    if (error && isMissingSchemaError(error)) return { ok: false, error: NOT_AVAILABLE_ERROR };
    console.error("[roomChange] insert failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "room_change_requested",
    entityType: "room_change_requests",
    entityId: inserted.id as string,
    newValue: { permission: access.permission, origin: "residence", ...fields },
  });
  await notifyStudent(admin, (stay.student_profile_id as string | null) ?? null, inserted.id as string, {
    title: "Tu residencia anotó tu pedido de cambio de habitación",
    body: "Quedó anotado, sujeto a disponibilidad. Si se concreta, se asumen los costos que correspondan y te los informa la residencia. Podés verlo y cancelarlo desde Mi residencia.",
  });
  return { ok: true, message: "Anotamos el pedido de cambio de habitación." };
}

/**
 * La residencia mueve el estado de un pedido abierto: pendiente ⇄ en gestión, o lo cierra (resuelta / cancelada). El estudiante (si tiene cuenta)
 * recibe un aviso. Cerrar con una plaza ofrecida: resuelta → el aviso de plaza también se cierra; cancelada → la plaza vuelve a quedar por decidir.
 */
export async function updateRoomChangeStatusByResidence(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; requestId: string; to: string },
): Promise<RoomChangeResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  if (!isRoomChangeStatus(params.to)) return { ok: false, error: "Ese estado no es válido." };
  const to: RoomChangeStatus = params.to;

  const { row, failed, missing } = await loadRequest(admin, params.requestId);
  if (failed) return { ok: false, error: missing ? NOT_AVAILABLE_ERROR : GENERIC_ERROR };
  if (!row || row.residence_id !== params.residenceId) return { ok: false, error: NOT_FOUND_ERROR };
  if (!isRoomChangeStatus(row.status) || !canResidenceMoveRoomChange(row.status, to)) {
    return { ok: false, error: "Ese pedido ya no admite este cambio. Recargá la pantalla." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> =
    to === "pending"
      ? { status: "pending", offered_bed_id: null, offered_label: null, offered_at: null, offered_by_user_id: null }
      : to === "offered"
        ? { status: "offered" }
        : {
            status: to,
            closed_reason: to === "resolved" ? "resolved_by_residence" : "cancelled_by_residence",
            resolved_at: now,
            resolved_by_user_id: params.actorUserId,
          };
  // Update condicional al estado leído: dos personas del equipo no pisan el mismo pedido.
  const { data: updated, error } = await admin
    .from("room_change_requests")
    .update(patch)
    .eq("id", row.id)
    .eq("residence_id", params.residenceId)
    .eq("status", row.status)
    .select("id");
  if (error || !updated || updated.length === 0) {
    if (error) console.error("[roomChange] status update failed:", error);
    return { ok: false, error: error ? GENERIC_ERROR : "Ese pedido cambió mientras lo mirabas. Recargá la pantalla." };
  }

  if (to === "pending" || to === "cancelled") await releaseOfferedAlerts(admin, params.residenceId, row.id, "pending", params.actorUserId);
  if (to === "resolved") await releaseOfferedAlerts(admin, params.residenceId, row.id, "resolved", params.actorUserId);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "room_change_status_changed",
    entityType: "room_change_requests",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { permission: access.permission, status: to },
  });

  const copy: Record<string, { title: string; body: string } | undefined> = {
    offered: {
      title: "Tu pedido de cambio de habitación está en gestión",
      body: "Tu residencia lo está viendo. Sigue sujeto a disponibilidad y a los costos que correspondan.",
    },
    resolved: { title: "Tu pedido de cambio de habitación quedó resuelto", body: "Cualquier duda, hablá con tu residencia o escribinos a Soporte." },
    cancelled: { title: "Tu residencia cerró tu pedido de cambio de habitación", body: "Si querés, podés pedirlo de nuevo desde Mi residencia. Cualquier duda, escribinos a Soporte." },
  };
  const entry = copy[to];
  if (entry && row.origin === "student") await notifyStudent(admin, row.student_profile_id, row.id, entry);

  const message: Record<string, string> = {
    pending: "Volvió a pendiente.",
    offered: "Quedó en gestión.",
    resolved: "Marcamos el pedido como resuelto.",
    cancelled: "Cancelaste el pedido.",
  };
  return { ok: true, message: message[to] };
}

type AlertRow = {
  id: string;
  residence_id: string;
  bed_id: string | null;
  room_type_id: string | null;
  place_label: string;
  status: string;
  deferred_increment: boolean;
};

/**
 * Decisión de la residencia sobre una plaza liberada que coincide con un pedido (DR34):
 *  - `offer`: se la ofrece al residente del pedido `requestId` (queda «en gestión» con esa plaza y el residente recibe un aviso). Solo si la
 *    plaza sigue por decidir.
 *  - `ignore`: la cierra sin avisar a nadie y SIN publicarla (la residencia puede cargarla cuando quiera desde Disponibilidad).
 *  - `publish`: la publica como disponible. Si el +1 de la salida había quedado diferido, se repone ahora. Exige `operations.rooms_availability`.
 */
export async function decideFreedPlaceByResidence(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; alertId: string; decision: PlaceAlertDecision; requestId?: string | null },
): Promise<RoomChangeResult> {
  const permission = params.decision === "publish" ? "operations.rooms_availability" : "residents.manage";
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, permission);
  if (!access.ok) return { ok: false, error: access.error };

  const { data, error: alertError } = await admin
    .from("room_change_place_alerts")
    .select("id, residence_id, bed_id, room_type_id, place_label, status, deferred_increment")
    .eq("id", params.alertId)
    .maybeSingle();
  if (alertError) {
    if (isMissingSchemaError(alertError)) return { ok: false, error: NOT_AVAILABLE_ERROR };
    console.error("[roomChange] alert read failed:", alertError);
    return { ok: false, error: GENERIC_ERROR };
  }
  const alert = data as AlertRow | null;
  if (!alert || alert.residence_id !== params.residenceId) return { ok: false, error: "No encontramos ese aviso de plaza." };
  if (!OPEN.includes(alert.status)) return { ok: false, error: "Ese aviso ya se resolvió. Recargá la pantalla." };

  const now = new Date().toISOString();
  const closeBase = { resolved_at: now, resolved_by_user_id: params.actorUserId };

  if (params.decision === "offer") {
    if (alert.status !== "pending") return { ok: false, error: "Esta plaza ya se le ofreció a otro residente." };
    if (!params.requestId) return { ok: false, error: "Elegí a qué residente se la ofrecés." };
    const { row, failed, missing } = await loadRequest(admin, params.requestId);
    if (failed) return { ok: false, error: missing ? NOT_AVAILABLE_ERROR : GENERIC_ERROR };
    if (!row || row.residence_id !== params.residenceId || !OPEN.includes(row.status)) {
      return { ok: false, error: "Ese pedido ya no está abierto. Recargá la pantalla." };
    }
    // Primero la alerta (condicional a «por decidir»): si dos personas la ofrecen a la vez, solo una gana.
    const { data: claimed, error: claimError } = await admin
      .from("room_change_place_alerts")
      .update({ status: "offered", offered_request_id: row.id })
      .eq("id", alert.id)
      .eq("residence_id", params.residenceId)
      .eq("status", "pending")
      .select("id");
    if (claimError || !claimed || claimed.length === 0) {
      if (claimError) console.error("[roomChange] alert claim failed:", claimError);
      return { ok: false, error: claimError ? GENERIC_ERROR : "Esta plaza ya se le ofreció a otro residente." };
    }
    const { data: offered, error: offerError } = await admin
      .from("room_change_requests")
      .update({
        status: "offered",
        offered_bed_id: alert.bed_id,
        offered_label: alert.place_label.slice(0, 120),
        offered_at: now,
        offered_by_user_id: params.actorUserId,
      })
      .eq("id", row.id)
      .eq("residence_id", params.residenceId)
      .in("status", OPEN)
      .select("id");
    if (offerError || !offered || offered.length === 0) {
      // Se deshace la reserva de la alerta: la plaza sigue por decidir.
      await admin.from("room_change_place_alerts").update({ status: "pending", offered_request_id: null }).eq("id", alert.id).eq("status", "offered");
      if (offerError) console.error("[roomChange] offer update failed:", offerError);
      return { ok: false, error: offerError ? GENERIC_ERROR : "Ese pedido ya no está abierto. Recargá la pantalla." };
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "room_change_place_offered",
      entityType: "room_change_place_alerts",
      entityId: alert.id,
      newValue: { permission: access.permission, request_id: row.id },
    });
    if (row.student_profile_id) {
      await notifyStudent(admin, row.student_profile_id, row.id, {
        title: "Tu residencia te ofrece cambiar de habitación",
        body: `Se liberó una plaza que coincide con tu pedido: ${alert.place_label}. Sigue sujeto a disponibilidad y a los costos que correspondan, que te informa la residencia. Coordinalo con ella.`,
      });
    }
    return { ok: true, message: "Se la ofreciste. La plaza no se publica mientras tanto." };
  }

  if (params.decision === "ignore") {
    const { data: closed, error } = await admin
      .from("room_change_place_alerts")
      .update({ status: "ignored", ...closeBase })
      .eq("id", alert.id)
      .eq("residence_id", params.residenceId)
      .in("status", OPEN)
      .select("id");
    if (error || !closed || closed.length === 0) {
      if (error) console.error("[roomChange] ignore failed:", error);
      return { ok: false, error: error ? GENERIC_ERROR : "Ese aviso ya se resolvió. Recargá la pantalla." };
    }
    await releaseOfferedRequest(admin, params.residenceId, alert.id);
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "room_change_place_ignored",
      entityType: "room_change_place_alerts",
      entityId: alert.id,
      newValue: { permission: access.permission },
    });
    return { ok: true, message: "Ignoraste el aviso. La plaza no se publicó: podés cargarla desde Disponibilidad." };
  }

  // publish
  const { data: closed, error } = await admin
    .from("room_change_place_alerts")
    .update({ status: "published", ...closeBase })
    .eq("id", alert.id)
    .eq("residence_id", params.residenceId)
    .in("status", OPEN)
    .select("id");
  if (error || !closed || closed.length === 0) {
    if (error) console.error("[roomChange] publish failed:", error);
    return { ok: false, error: error ? GENERIC_ERROR : "Ese aviso ya se resolvió. Recargá la pantalla." };
  }
  // El +1 de la salida que había quedado diferido (solo ese caso: cambios de cama y reactivaciones nunca tocaron el contador).
  if (alert.deferred_increment && alert.room_type_id) await incrementAvailabilityOnRelease(admin, alert.room_type_id, params.residenceId);
  await releaseOfferedRequest(admin, params.residenceId, alert.id);
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "room_change_place_published",
    entityType: "room_change_place_alerts",
    entityId: alert.id,
    newValue: { permission: access.permission, deferred_increment: alert.deferred_increment },
  });
  return {
    ok: true,
    message: alert.deferred_increment
      ? "Publicaste la plaza: sumamos 1 a la disponibilidad del tipo."
      : "Listo. Revisá la cantidad disponible de ese tipo en Disponibilidad.",
  };
}

/** Si la plaza estaba ofrecida a un pedido y se la ignora o publica, ese pedido sigue abierto pero sin plaza ofrecida (vuelve a pendiente). */
async function releaseOfferedRequest(admin: SupabaseClient, residenceId: string, alertId: string): Promise<void> {
  const { data } = await admin.from("room_change_place_alerts").select("offered_request_id").eq("id", alertId).maybeSingle();
  const requestId = (data as { offered_request_id?: string | null } | null)?.offered_request_id;
  if (!requestId) return;
  const { error } = await admin
    .from("room_change_requests")
    .update({ status: "pending", offered_bed_id: null, offered_label: null, offered_at: null, offered_by_user_id: null })
    .eq("id", requestId)
    .eq("residence_id", residenceId)
    .eq("status", "offered");
  if (error) console.error("[roomChange] release offered request failed:", error);
}
