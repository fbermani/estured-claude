import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

type Result = { ok: true } | { ok: false; error: string };

/** Renombra una habitación ("Habitación 1" → "203", "Piso 2 - B", etc.). */
export async function renameRoom(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; roomId: string; label: string },
): Promise<Result> {
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

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
    actorRole: "residence_owner",
    action: "room_renamed",
    entityType: "rooms",
    entityId: params.roomId,
    newValue: { label },
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
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  if (params.status === "out_of_service") {
    const { data: occupant } = await admin
      .from("resident_stays")
      .select("id")
      .eq("bed_id", params.bedId)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (occupant)
      return { ok: false, error: "Esa cama tiene un residente asignado. Reubicalo antes de sacarla de servicio." };
  }

  const { data: bed, error } = await admin
    .from("beds")
    .update({
      status: params.status,
      out_of_service_reason: params.status === "out_of_service" ? params.reason?.trim() || null : null,
    })
    .eq("id", params.bedId)
    .select("id, rooms(residence_id)")
    .maybeSingle();
  if (error || !bed) return { ok: false, error: "No pudimos actualizar la cama." };
  const roomInfo = bed.rooms as unknown as { residence_id: string } | null;
  if (roomInfo?.residence_id !== params.residenceId)
    return { ok: false, error: "Esa cama no pertenece a esta residencia." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: params.status === "out_of_service" ? "bed_marked_out_of_service" : "bed_reactivated",
    entityType: "beds",
    entityId: params.bedId,
    newValue: { reason: params.reason ?? null },
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
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

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

  const { error } = await admin
    .from("resident_stays")
    .update({ bed_id: params.bedId, room_id: bed.room_id, room_type_id: bedRoom.room_type_id })
    .eq("id", params.residentStayId);
  if (error) return { ok: false, error: "No pudimos asignar la cama." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "resident_stay_bed_assigned",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    newValue: { bed_id: params.bedId, room_id: bed.room_id },
  });
  return { ok: true };
}
