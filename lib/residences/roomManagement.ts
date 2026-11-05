import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { validateRoomGender } from "@/lib/residences/roomGender";
import { onStayMovedToBed, registerFreedPlace } from "@/lib/roomChange/freedPlace";
import { canMarkRoomOutOfService, planBulkGenderChange, roomOutOfServiceReason } from "@/lib/residences/roomBulk";

type Result = { ok: true } | { ok: false; error: string };

/** Renombra una habitación ("Habitación 1" → "203", "Piso 2 - B", etc.). */
export async function renameRoom(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; roomId: string; label: string },
): Promise<Result> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  const label = params.label.trim();
  if (label.length < 1 || label.length > 40)
    return { ok: false, error: "El nombre debe tener entre 1 y 40 caracteres." };

  const { data: room, error } = await admin
    .from("rooms")
    .update({ label })
    .eq("id", params.roomId)
    .eq("residence_id", params.residenceId)
    .select("id")
    .maybeSingle();
  if (error || !room) return { ok: false, error: "No pudimos renombrar la habitación." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "room_renamed",
    entityType: "rooms",
    entityId: params.roomId,
    newValue: { permission: access.permission, label },
  });
  return { ok: true };
}

/** Cambia el género de una habitación (DR18 punto 15). Compartida: no admite «sin especificar». */
export async function setRoomGender(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; roomId: string; gender: string },
): Promise<Result> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };

  const { data: room, error: readError } = await admin
    .from("rooms")
    .select("id, room_types(capacity_per_room)")
    .eq("id", params.roomId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (readError) return { ok: false, error: "No pudimos leer la habitación. Probá de nuevo en unos minutos." };
  if (!room) return { ok: false, error: "No encontramos esa habitación." };
  const rt = room.room_types as unknown as { capacity_per_room: number | null } | { capacity_per_room: number | null }[] | null;
  const capacity = Array.isArray(rt) ? rt[0]?.capacity_per_room : rt?.capacity_per_room;

  const checked = validateRoomGender(params.gender, capacity);
  if (!checked.ok) return { ok: false, error: checked.error };

  const { error } = await admin
    .from("rooms")
    .update({ gender: checked.gender })
    .eq("id", params.roomId)
    .eq("residence_id", params.residenceId);
  if (error) {
    const missingColumn = /gender/i.test(error.message ?? "") && /column|schema/i.test(error.message ?? "");
    return {
      ok: false,
      error: missingColumn
        ? "El género por habitación todavía no está disponible. Probá de nuevo más tarde."
        : "No pudimos guardar el género de la habitación.",
    };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "room_gender_updated",
    entityType: "rooms",
    entityId: params.roomId,
    newValue: { permission: access.permission, gender: checked.gender },
  });
  return { ok: true };
}

/**
 * Marca una cama fuera de servicio (con razón) o la reactiva — modal de
 * la referencia: "Fuera de Servicio (OOO) · Razón: Mantenimiento…".
 * Una cama ocupada no puede salir de servicio.
 */
export async function setBedStatus(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    bedId: string;
    status: "active" | "out_of_service";
    reason: string | null;
  },
): Promise<Result> {
  // El valor llega del cliente por una server action: se valida en runtime (el tipo de TS no existe acá).
  if (params.status !== "active" && params.status !== "out_of_service") return { ok: false, error: "Estado de cama no válido." };
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  // IDOR: primero se LEE la cama con su habitación y se valida que sea de ESTA residencia; recién entonces se escribe (antes se actualizaba
  // por id y se miraba la residencia después, con la cama ajena ya modificada).
  const { data: bed, error: bedError } = await admin
    .from("beds")
    .select("id, room_id, status, rooms(residence_id)")
    .eq("id", params.bedId)
    .maybeSingle();
  if (bedError) {
    console.error("[rooms] setBedStatus read failed:", bedError);
    return { ok: false, error: "No pudimos actualizar la cama." };
  }
  const roomInfo = (bed?.rooms ?? null) as unknown as { residence_id: string } | { residence_id: string }[] | null;
  const bedResidenceId = Array.isArray(roomInfo) ? roomInfo[0]?.residence_id : roomInfo?.residence_id;
  if (!bed || bedResidenceId !== params.residenceId) return { ok: false, error: "Esa cama no pertenece a esta residencia." };

  if (params.status === "out_of_service") {
    const { data: occupant } = await admin
      .from("resident_stays")
      .select("id")
      .eq("bed_id", params.bedId)
      .eq("residence_id", params.residenceId)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (occupant)
      return { ok: false, error: "Esa cama tiene un residente asignado. Reubicalo antes de sacarla de servicio." };
  }

  // Update condicionado también por la habitación (que ya sabemos que es de esta residencia) y con chequeo de filas.
  const { data: updatedBed, error } = await admin
    .from("beds")
    .update({
      status: params.status,
      out_of_service_reason: params.status === "out_of_service" ? params.reason?.trim() || null : null,
    })
    .eq("id", params.bedId)
    .eq("room_id", bed.room_id)
    .select("id")
    .maybeSingle();
  if (error || !updatedBed) return { ok: false, error: "No pudimos actualizar la cama." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: params.status === "out_of_service" ? "bed_marked_out_of_service" : "bed_reactivated",
    entityType: "beds",
    entityId: params.bedId,
    newValue: { permission: access.permission, reason: params.reason ?? null },
  });
  // DR34: una cama que vuelve a servicio es una plaza que reaparece: si coincide con un pedido de cambio de habitación, se avisa antes de publicarla.
  if (params.status === "active" && bed.status === "out_of_service") {
    await registerFreedPlace(admin, { residenceId: params.residenceId, source: "bed_reactivated", bedId: params.bedId });
  }
  return { ok: true };
}

/**
 * Asigna (o reubica) un residente actual a una cama puntual. La cama
 * debe estar activa y libre; el room_id de la estadía se sincroniza con
 * el de la cama.
 */
export async function assignStayToBed(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; residentStayId: string; bedId: string },
): Promise<Result> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  const [{ data: stay }, { data: bed }, { data: occupant }] = await Promise.all([
    admin
      .from("resident_stays")
      .select("id, residence_id, is_current, bed_id")
      .eq("id", params.residentStayId)
      .maybeSingle(),
    admin
      .from("beds")
      .select("id, status, room_id, rooms(residence_id, room_type_id)")
      .eq("id", params.bedId)
      .maybeSingle(),
    admin
      .from("resident_stays")
      .select("id")
      .eq("bed_id", params.bedId)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!stay || stay.residence_id !== params.residenceId || !stay.is_current)
    return { ok: false, error: "Esa estadía no está activa en esta residencia." };
  const bedRoom = bed?.rooms as unknown as { residence_id: string; room_type_id: string } | null;
  if (!bed || bedRoom?.residence_id !== params.residenceId)
    return { ok: false, error: "Esa cama no pertenece a esta residencia." };
  if (bed.status !== "active") return { ok: false, error: "Esa cama está fuera de servicio." };
  if (occupant && occupant.id !== params.residentStayId)
    return { ok: false, error: "Esa cama ya está ocupada." };

  const { data: updated, error } = await admin
    .from("resident_stays")
    .update({ bed_id: params.bedId, room_id: bed.room_id, room_type_id: bedRoom.room_type_id })
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .eq("is_current", true)
    .select("id");
  if (error || !updated || updated.length === 0) return { ok: false, error: "No pudimos asignar la cama." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "resident_stay_bed_assigned",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    newValue: { permission: access.permission, bed_id: params.bedId, room_id: bed.room_id },
  });
  // DR34: si le habían ofrecido justo esta cama, su pedido de cambio queda resuelto; la cama que dejó es una plaza liberada.
  await onStayMovedToBed(admin, {
    residenceId: params.residenceId,
    residentStayId: params.residentStayId,
    newBedId: params.bedId,
    previousBedId: (stay.bed_id as string | null) ?? null,
    actorUserId: params.actorUserId,
  });
  return { ok: true };
}

/**
 * Cambia el género de VARIAS habitaciones a la vez. Todas tienen que ser de esta residencia y cumplir la regla individual (una compartida
 * no puede quedar «sin especificar»); si alguna no cumple, no se cambia ninguna. Una auditoría por habitación.
 */
export async function setRoomsGenderBulk(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; roomIds: string[]; gender: string },
): Promise<Result & { changed?: number }> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };

  const ids = [...new Set(params.roomIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "Elegí al menos una habitación." };
  const { data: rooms, error: readError } = await admin
    .from("rooms")
    .select("id, label, room_types(capacity_per_room)")
    .in("id", ids)
    .eq("residence_id", params.residenceId)
    .eq("is_active", true);
  if (readError) return { ok: false, error: "No pudimos leer las habitaciones. Probá de nuevo en unos minutos." };
  if (!rooms || rooms.length !== ids.length) return { ok: false, error: "Alguna habitación no existe o no es de esta residencia." };

  const plan = planBulkGenderChange(
    rooms.map((room) => {
      const rt = room.room_types as unknown as { capacity_per_room: number | null } | { capacity_per_room: number | null }[] | null;
      return { id: room.id as string, label: room.label as string, capacityPerRoom: Array.isArray(rt) ? rt[0]?.capacity_per_room : rt?.capacity_per_room };
    }),
    params.gender,
  );
  if (!plan.ok) return { ok: false, error: plan.error };

  const { data: updated, error } = await admin
    .from("rooms")
    .update({ gender: plan.gender })
    .in("id", plan.roomIds)
    .eq("residence_id", params.residenceId)
    .select("id");
  if (error || !updated) {
    const missingColumn = /gender/i.test(error?.message ?? "") && /column|schema/i.test(error?.message ?? "");
    return {
      ok: false,
      error: missingColumn
        ? "El género por habitación todavía no está disponible. Probá de nuevo más tarde."
        : "No pudimos cambiar el género de las habitaciones.",
    };
  }

  for (const row of updated) {
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "room_gender_updated",
      entityType: "rooms",
      entityId: row.id as string,
      newValue: { permission: access.permission, gender: plan.gender, bulk: true },
    });
  }
  return { ok: true, changed: updated.length };
}

/**
 * Saca una habitación de servicio (todas sus camas, con una razón) o la reactiva. Usa el mismo mecanismo que las camas: nunca toca
 * `is_active` (la habitación sigue contando como tal). No se puede sacar de servicio con residentes asignados.
 */
export async function setRoomOutOfService(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; roomId: string; outOfService: boolean; reason: string | null },
): Promise<Result> {
  if (typeof params.outOfService !== "boolean") return { ok: false, error: "Valor no válido." };
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };

  const { data: room, error: roomError } = await admin
    .from("rooms")
    .select("id")
    .eq("id", params.roomId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (roomError) return { ok: false, error: "No pudimos leer la habitación. Probá de nuevo en unos minutos." };
  if (!room) return { ok: false, error: "No encontramos esa habitación." };

  const { data: beds, error: bedsError } = await admin.from("beds").select("id, status").eq("room_id", params.roomId);
  if (bedsError) return { ok: false, error: "No pudimos leer las camas de la habitación." };
  const bedIds = (beds ?? []).map((b) => b.id as string);
  const wasOutOfServiceBedIds = (beds ?? []).filter((b) => b.status === "out_of_service").map((b) => b.id as string);

  if (params.outOfService) {
    const { data: occupants, error: stayError } = bedIds.length
      ? await admin.from("resident_stays").select("bed_id").in("bed_id", bedIds).eq("residence_id", params.residenceId).eq("is_current", true)
      : { data: [], error: null };
    if (stayError) return { ok: false, error: "No pudimos verificar si hay residentes en la habitación." };
    const occupied = new Set((occupants ?? []).map((o) => o.bed_id as string));
    const check = canMarkRoomOutOfService(bedIds.map((id) => ({ occupied: occupied.has(id) })));
    if (!check.ok) return { ok: false, error: check.error };
  }

  const { data: updated, error } = await admin
    .from("beds")
    .update({
      status: params.outOfService ? "out_of_service" : "active",
      out_of_service_reason: params.outOfService ? roomOutOfServiceReason(params.reason) : null,
    })
    .eq("room_id", params.roomId)
    .select("id");
  if (error || !updated) return { ok: false, error: "No pudimos actualizar la habitación." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: params.outOfService ? "room_marked_out_of_service" : "room_reactivated",
    entityType: "rooms",
    entityId: params.roomId,
    newValue: { permission: access.permission, beds: updated.length, reason: params.outOfService ? roomOutOfServiceReason(params.reason) : null },
  });
  // DR34: las camas que vuelven a servicio son plazas que reaparecen (un solo aviso al equipo por habitación).
  if (!params.outOfService) {
    let notified = false;
    for (const bedId of wasOutOfServiceBedIds) {
      const result = await registerFreedPlace(admin, { residenceId: params.residenceId, source: "room_reactivated", bedId, notify: !notified });
      if (result.held) notified = true;
    }
  }
  return { ok: true };
}
