import { validateRoomGender, type RoomGender } from "@/lib/residences/roomGender";

/**
 * Operaciones en lote sobre habitaciones (pantalla Habitaciones). Lógica PURA: las valida y arma el plan; el servidor (`roomManagement.ts`)
 * es quien controla el permiso y escribe.
 */

export const MAX_BULK_ROOMS = 100;
export const ROOM_OUT_OF_SERVICE_DEFAULT_REASON = "Habitación fuera de servicio";

/**
 * Cambiar el género de varias habitaciones a la vez. Cada una se valida con la misma regla que el cambio individual
 * (`validateRoomGender`: una compartida no puede quedar «sin especificar»). Si alguna no cumple, no se cambia ninguna.
 */
export function planBulkGenderChange(
  rooms: readonly { id: string; label: string; capacityPerRoom: number | null | undefined }[],
  gender: unknown,
): { ok: true; gender: RoomGender; roomIds: string[] } | { ok: false; error: string } {
  if (rooms.length === 0) return { ok: false, error: "Elegí al menos una habitación." };
  if (rooms.length > MAX_BULK_ROOMS) return { ok: false, error: `Podés cambiar hasta ${MAX_BULK_ROOMS} habitaciones por vez.` };
  let chosen: RoomGender | null = null;
  for (const room of rooms) {
    const checked = validateRoomGender(gender, room.capacityPerRoom);
    if (!checked.ok) {
      return {
        ok: false,
        error: checked.error.includes("compartida")
          ? `«${room.label}» es compartida: tiene que ser masculina, femenina o mixta. No se cambió ninguna habitación.`
          : checked.error,
      };
    }
    chosen = checked.gender;
  }
  return { ok: true, gender: chosen as RoomGender, roomIds: rooms.map((r) => r.id) };
}

/** Una habitación solo sale de servicio si ninguna de sus camas tiene un residente asignado (hay que reubicarlo antes). */
export function canMarkRoomOutOfService(beds: readonly { occupied: boolean }[]): { ok: true } | { ok: false; error: string } {
  if (beds.length === 0) return { ok: false, error: "Esta habitación no tiene camas cargadas." };
  if (beds.some((b) => b.occupied)) {
    return { ok: false, error: "Hay residentes asignados en esta habitación. Reubicalos antes de sacarla de servicio." };
  }
  return { ok: true };
}

/** Razón visible de la habitación fuera de servicio: la que escribió la residencia, o la genérica. */
export function roomOutOfServiceReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? "").trim().slice(0, 200);
  return trimmed || ROOM_OUT_OF_SERVICE_DEFAULT_REASON;
}
