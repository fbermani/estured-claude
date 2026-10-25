import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";

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
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "operations.rooms_availability");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  // IDOR: primero se LEE la cama con su habitación y se valida que sea de ESTA residencia; recién entonces se escribe (antes se actualizaba
  // por id y se miraba la residencia después, con la cama ajena ya modificada).
  const { data: bed, error: bedError } = await admin
    .from("beds")
    .select("id, room_id, rooms(residence_id)")
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
      .select("id, residence_id, is_current")
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
  return { ok: true };
}
