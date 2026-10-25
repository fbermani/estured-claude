import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const BED_LETTERS = "ABCDEFGHIJ";

/**
 * Sincroniza las habitaciones físicas (y sus camas) de un tipo con la
 * cantidad definida en la configuración (decisión del dueño 2026-07-17:
 * "auto + renombrable" — el sistema genera "Habitación N" y la
 * residencia las renombra después en el módulo de habitaciones).
 *
 * Reglas de seguridad:
 *  - Nunca borra: al reducir cantidad, desactiva (`is_active = false`)
 *    solo habitaciones SIN residentes actuales, de la última hacia
 *    atrás. Si no alcanza, devuelve un warning y deja las ocupadas.
 *  - Reactiva habitaciones desactivadas antes de crear nuevas (así un
 *    sube-baja de cantidad no acumula filas).
 *  - Camas: asegura letras A..capacidad por habitación activa; las
 *    camas sobrantes (si bajó la capacidad del tipo) se eliminan solo
 *    si ninguna estadía las referencia — si no, warning.
 */
export async function syncRoomsAndBeds(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    roomTypeId: string;
    desiredRoomCount: number;
    capacityPerRoom: number;
  },
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  const warnings: string[] = [];
  const capacity = Math.min(BED_LETTERS.length, Math.max(1, params.capacityPerRoom));
  const desired = Math.max(0, params.desiredRoomCount);

  // IDOR: el tipo de habitación tiene que ser de ESTA residencia. Sin esto, un `roomTypeId` ajeno mezclaba habitaciones y camas de otra
  // residencia (las lecturas eran solo por `room_type_id`). Todas las lecturas y escrituras de abajo filtran además por residencia.
  const { data: ownType, error: ownTypeError } = await admin
    .from("room_types")
    .select("id")
    .eq("id", params.roomTypeId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (ownTypeError) {
    console.error("[rooms] sync type read failed:", ownTypeError);
    return { ok: false, error: "No pudimos leer las habitaciones actuales." };
  }
  if (!ownType) return { ok: false, error: "Ese tipo de habitación no pertenece a esta residencia." };

  const [{ data: rooms, error: roomsError }, { data: stays }] = await Promise.all([
    admin
      .from("rooms")
      .select("id, label, sort_order, is_active")
      .eq("room_type_id", params.roomTypeId)
      .eq("residence_id", params.residenceId)
      .order("sort_order", { ascending: true }),
    admin
      .from("resident_stays")
      .select("id, room_id, bed_id")
      .eq("residence_id", params.residenceId)
      .eq("room_type_id", params.roomTypeId)
      .eq("is_current", true),
  ]);
  if (roomsError) {
    console.error("[rooms] sync read failed:", roomsError);
    return { ok: false, error: "No pudimos leer las habitaciones actuales." };
  }

  const occupiedRoomIds = new Set((stays ?? []).map((s) => s.room_id).filter(Boolean));
  const all = rooms ?? [];
  const active = all.filter((r) => r.is_active);

  if (active.length < desired) {
    // Primero reactivar desactivadas (las más antiguas primero).
    const toReactivate = all.filter((r) => !r.is_active).slice(0, desired - active.length);
    if (toReactivate.length > 0) {
      const { error } = await admin
        .from("rooms")
        .update({ is_active: true })
        .in("id", toReactivate.map((r) => r.id))
        .eq("residence_id", params.residenceId);
      if (error) return { ok: false, error: "No pudimos reactivar habitaciones." };
    }
    const stillMissing = desired - active.length - toReactivate.length;
    const maxSort = all.reduce((max, r) => Math.max(max, r.sort_order), 0);
    for (let i = 0; i < stillMissing; i++) {
      const sortOrder = maxSort + i + 1;
      const { error } = await admin.from("rooms").insert({
        residence_id: params.residenceId,
        room_type_id: params.roomTypeId,
        label: `Habitación ${sortOrder}`,
        sort_order: sortOrder,
      });
      if (error) {
        console.error("[rooms] sync insert failed:", error);
        return { ok: false, error: "No pudimos crear las habitaciones nuevas." };
      }
    }
  } else if (active.length > desired) {
    const removable = active
      .filter((r) => !occupiedRoomIds.has(r.id))
      .slice(-(active.length - desired));
    if (removable.length < active.length - desired) {
      warnings.push(
        "No se pudieron dar de baja todas las habitaciones pedidas: algunas tienen residentes actuales.",
      );
    }
    if (removable.length > 0) {
      const { error } = await admin
        .from("rooms")
        .update({ is_active: false })
        .in("id", removable.map((r) => r.id))
        .eq("residence_id", params.residenceId);
      if (error) return { ok: false, error: "No pudimos dar de baja habitaciones." };
    }
  }

  // ==== camas por habitación activa ====
  const { data: freshRooms } = await admin
    .from("rooms")
    .select("id")
    .eq("room_type_id", params.roomTypeId)
    .eq("residence_id", params.residenceId)
    .eq("is_active", true);
  const activeIds = (freshRooms ?? []).map((r) => r.id);
  if (activeIds.length === 0) return { ok: true, warnings };

  const { data: beds } = await admin
    .from("beds")
    .select("id, room_id, letter")
    .in("room_id", activeIds);
  const bedsByRoom = new Map<string, { id: string; letter: string }[]>();
  for (const bed of beds ?? []) {
    const list = bedsByRoom.get(bed.room_id) ?? [];
    list.push({ id: bed.id, letter: bed.letter });
    bedsByRoom.set(bed.room_id, list);
  }
  const bedsInUse = new Set((stays ?? []).map((s) => s.bed_id).filter(Boolean));

  for (const roomId of activeIds) {
    const existing = bedsByRoom.get(roomId) ?? [];
    const existingLetters = new Set(existing.map((b) => b.letter));
    const missing = [];
    for (let i = 0; i < capacity; i++) {
      const letter = BED_LETTERS[i];
      if (!existingLetters.has(letter)) {
        missing.push({ room_id: roomId, letter, sort_order: i });
      }
    }
    if (missing.length > 0) {
      const { error } = await admin.from("beds").insert(missing);
      if (error) {
        console.error("[beds] sync insert failed:", error);
        return { ok: false, error: "No pudimos crear las camas." };
      }
    }
    const extra = existing.filter((b) => BED_LETTERS.indexOf(b.letter) >= capacity);
    const deletable = extra.filter((b) => !bedsInUse.has(b.id));
    if (deletable.length < extra.length) {
      warnings.push("Alguna cama sobrante no se pudo quitar porque tiene un residente asignado.");
    }
    if (deletable.length > 0) {
      // Solo camas de las habitaciones activas de esta residencia (`activeIds` sale de lecturas filtradas por residencia).
      await admin.from("beds").delete().in("id", deletable.map((b) => b.id)).in("room_id", activeIds);
    }
  }

  return { ok: true, warnings };
}
