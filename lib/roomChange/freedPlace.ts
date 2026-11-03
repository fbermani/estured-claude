import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { effectiveRoomGender, genderFromPolicy } from "@/lib/residences/roomGender";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { requestMatchesPlace, type PlaceAlertSource, type RequestForMatching } from "@/lib/roomChange/rules";

/**
 * Plaza liberada (DR34). Cuando una plaza queda libre (salida de un residente, cambio de cama, cama o habitación que vuelve a estar en
 * servicio) y coincide con el pedido PENDIENTE de algún residente, se crea un aviso por decidir y se avisa al equipo ANTES de que la plaza
 * se publique como disponible. Nunca lanza: un aviso que falla no puede tumbar la operación que liberó la plaza (en ese caso la plaza sigue
 * el camino de antes). Si la migración 0076 no está aplicada, no hace nada.
 */

export type PlaceInfo = { roomTypeId: string | null; gender: string | null; label: string };

type RoomEmbed = {
  id: string;
  label: string;
  gender: string | null;
  residence_id: string;
  room_type_id: string;
  room_types: { name: string; gender_policy: string | null; capacity_per_room: number | null } | null;
};

/** Datos de una cama para describir la plaza: tipo, género efectivo de la habitación y una etiqueta legible. `null` si no es de esta residencia. */
export async function loadBedPlace(admin: SupabaseClient, residenceId: string, bedId: string): Promise<PlaceInfo | null> {
  const { data, error } = await admin
    .from("beds")
    .select("id, letter, rooms(id, label, gender, residence_id, room_type_id, room_types(name, gender_policy, capacity_per_room))")
    .eq("id", bedId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[roomChange] bed read failed:", error);
    return null;
  }
  const bed = data as unknown as { id: string; letter: string; rooms: RoomEmbed | RoomEmbed[] | null };
  const room = Array.isArray(bed.rooms) ? bed.rooms[0] : bed.rooms;
  if (!room || room.residence_id !== residenceId) return null;
  const type = room.room_types;
  const gender = effectiveRoomGender({ roomGender: room.gender, typePolicy: type?.gender_policy, capacityPerRoom: type?.capacity_per_room });
  return {
    roomTypeId: room.room_type_id,
    gender,
    label: `${room.label} · Cama ${bed.letter}${type?.name ? ` (${type.name})` : ""}`,
  };
}

/** Plaza descrita solo por tipo (residente sin cama asignada). */
export async function loadTypePlace(admin: SupabaseClient, residenceId: string, roomTypeId: string): Promise<PlaceInfo | null> {
  const { data, error } = await admin
    .from("room_types")
    .select("id, name, gender_policy")
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (error || !data) return null;
  const type = data as { name: string; gender_policy: string | null };
  return { roomTypeId, gender: genderFromPolicy(type.gender_policy), label: `Una plaza en ${type.name}` };
}

type PendingRequestRow = { id: string; resident_stay_id: string; status: string; preferred_room_type_id: string | null; preferred_gender: string | null };

/** Pedidos pendientes de la residencia, en la forma que usa `requestMatchesPlace`. Falla (o falta la migración) → lista vacía. */
export async function loadPendingRequestsForMatching(admin: SupabaseClient, residenceId: string): Promise<RequestForMatching[]> {
  const { data, error } = await admin
    .from("room_change_requests")
    .select("id, resident_stay_id, status, preferred_room_type_id, preferred_gender")
    .eq("residence_id", residenceId)
    .eq("status", "pending");
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[roomChange] pending requests read failed:", error);
    return [];
  }
  return ((data ?? []) as PendingRequestRow[]).map((r) => ({
    id: r.id,
    residentStayId: r.resident_stay_id,
    status: r.status,
    preferredRoomTypeId: r.preferred_room_type_id,
    preferredGender: r.preferred_gender,
  }));
}

export type RegisterFreedPlaceResult = { held: boolean; alertId?: string };

/**
 * Registra una plaza liberada. Devuelve `held: true` cuando creó un aviso por decidir (la plaza NO se publica sola mientras la residencia
 * decide); quien llama, si era una salida, NO repone el +1 de disponibilidad en ese caso (queda diferido: `deferredIncrement`).
 */
export async function registerFreedPlace(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    source: PlaceAlertSource;
    bedId?: string | null;
    roomTypeId?: string | null;
    freedByStayId?: string | null;
    /** true cuando el +1 automático de disponibilidad del tipo (salida de un residente) queda diferido hasta que la residencia decida. */
    deferredIncrement?: boolean;
    /** false para no avisar de nuevo (varias camas de una misma habitación que vuelve a servicio). */
    notify?: boolean;
  },
): Promise<RegisterFreedPlaceResult> {
  try {
    const requests = await loadPendingRequestsForMatching(admin, params.residenceId);
    if (requests.length === 0) return { held: false };

    const place = params.bedId
      ? await loadBedPlace(admin, params.residenceId, params.bedId)
      : params.roomTypeId
        ? await loadTypePlace(admin, params.residenceId, params.roomTypeId)
        : null;
    if (!place) return { held: false };
    if (!requests.some((r) => requestMatchesPlace(r, place, params.freedByStayId))) return { held: false };

    const { data: inserted, error } = await admin
      .from("room_change_place_alerts")
      .insert({
        residence_id: params.residenceId,
        bed_id: params.bedId ?? null,
        room_type_id: place.roomTypeId,
        place_label: place.label.slice(0, 160),
        gender: place.gender,
        source: params.source,
        status: "pending",
        deferred_increment: !!params.deferredIncrement,
        freed_by_stay_id: params.freedByStayId ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      // 23505: ya hay un aviso abierto para esa cama; se sigue el camino de antes.
      if (error && error.code !== "23505" && !isMissingSchemaError(error)) console.error("[roomChange] alert insert failed:", error);
      return { held: false };
    }
    if (params.notify !== false) {
      await notifyResidenceTeam(admin, { residenceId: params.residenceId, event: "room_change_place_matched", entityId: inserted.id as string });
    }
    return { held: true, alertId: inserted.id as string };
  } catch (error) {
    console.error("[roomChange] registerFreedPlace failed:", error);
    return { held: false };
  }
}

/**
 * Un residente cambió de cama (`assignStayToBed`): (1) si su pedido abierto tenía ofrecida justo esa cama, el pedido queda resuelto y el
 * aviso también; (2) la cama que dejó es una plaza liberada (se avisa si coincide con otro pedido). Nunca lanza.
 */
export async function onStayMovedToBed(
  admin: SupabaseClient,
  params: { residenceId: string; residentStayId: string; newBedId: string; previousBedId: string | null; actorUserId: string },
): Promise<void> {
  try {
    const { data: open, error } = await admin
      .from("room_change_requests")
      .select("id, status, offered_bed_id")
      .eq("residence_id", params.residenceId)
      .eq("resident_stay_id", params.residentStayId)
      .in("status", ["pending", "offered"])
      .maybeSingle();
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[roomChange] moved read failed:", error);
      return;
    }
    const request = open as { id: string; status: string; offered_bed_id: string | null } | null;
    const now = new Date().toISOString();
    if (request && request.status === "offered" && request.offered_bed_id === params.newBedId) {
      await admin
        .from("room_change_requests")
        .update({ status: "resolved", closed_reason: "moved", resolved_at: now, resolved_by_user_id: params.actorUserId })
        .eq("id", request.id)
        .in("status", ["pending", "offered"]);
      await admin
        .from("room_change_place_alerts")
        .update({ status: "resolved", resolved_at: now, resolved_by_user_id: params.actorUserId })
        .eq("residence_id", params.residenceId)
        .eq("offered_request_id", request.id)
        .in("status", ["pending", "offered"]);
    }
    if (params.previousBedId && params.previousBedId !== params.newBedId) {
      await registerFreedPlace(admin, {
        residenceId: params.residenceId,
        source: "bed_move",
        bedId: params.previousBedId,
        freedByStayId: params.residentStayId,
      });
    }
  } catch (error) {
    console.error("[roomChange] onStayMovedToBed failed:", error);
  }
}

/**
 * La estadía terminó: su pedido abierto se cierra solo (`stay_ended`) y, si había una plaza ofrecida, el aviso vuelve a quedar por decidir.
 * Nunca lanza.
 */
export async function closeRequestsOnStayEnded(admin: SupabaseClient, params: { residenceId: string; residentStayId: string }): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("room_change_requests")
      .update({ status: "cancelled", closed_reason: "stay_ended", resolved_at: now })
      .eq("residence_id", params.residenceId)
      .eq("resident_stay_id", params.residentStayId)
      .in("status", ["pending", "offered"])
      .select("id");
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[roomChange] close on stay ended failed:", error);
      return;
    }
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length) {
      await admin
        .from("room_change_place_alerts")
        .update({ status: "pending", offered_request_id: null })
        .eq("residence_id", params.residenceId)
        .in("offered_request_id", ids)
        .eq("status", "offered");
    }
  } catch (error) {
    console.error("[roomChange] closeRequestsOnStayEnded failed:", error);
  }
}
