import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { isRoomGender } from "@/lib/residences/roomGender";
import type { GenderRow, GenderRowStatus } from "@/lib/availability/genderAvailability";
import { isGenderRowStatus } from "@/lib/availability/genderAvailability";

export type StoredGenderRow = GenderRow & { roomTypeId: string; lastConfirmedAt: string | null };

/**
 * Detalle por género (migración 0075) de varios tipos. Sin la migración, o ante un error de lectura, devuelve `schemaReady: false` y un mapa
 * vacío: todo sigue funcionando por tipo, como antes. Es de solo lectura (service role); filtra siempre por tipos que el llamador ya validó.
 */
export async function loadGenderAvailability(
  admin: SupabaseClient,
  roomTypeIds: string[],
): Promise<{ byType: Map<string, StoredGenderRow[]>; schemaReady: boolean }> {
  const byType = new Map<string, StoredGenderRow[]>();
  if (roomTypeIds.length === 0) return { byType, schemaReady: true };
  const { data, error } = await admin
    .from("profile_availability_genders")
    .select("room_type_id, gender, status, available_count, available_from, notes_public, last_confirmed_at")
    .in("room_type_id", roomTypeIds);
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[availability-genders] lectura fallida:", error.code, error.message);
    return { byType, schemaReady: false };
  }
  for (const row of (data ?? []) as {
    room_type_id: string;
    gender: string;
    status: string;
    available_count: number | null;
    available_from: string | null;
    notes_public: string | null;
    last_confirmed_at: string | null;
  }[]) {
    if (!isRoomGender(row.gender) || !isGenderRowStatus(row.status)) continue;
    const list = byType.get(row.room_type_id) ?? [];
    list.push({
      roomTypeId: row.room_type_id,
      gender: row.gender,
      status: row.status as GenderRowStatus,
      availableCount: row.available_count,
      availableFrom: row.available_from,
      notesPublic: row.notes_public,
      lastConfirmedAt: row.last_confirmed_at,
    });
    byType.set(row.room_type_id, list);
  }
  return { byType, schemaReady: true };
}
