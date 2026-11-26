import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestBlockedMessage, typeAvailabilityState } from "@/lib/availability/typeAvailability";

export type RequestableRoomType =
  | { ok: true; roomType: { id: string; monthlyPriceUsd: number } }
  | { ok: false; error: string };

/**
 * Puerta única del servidor para una solicitud nueva (solicitud del estudiante, propuesta del familiar y su
 * aceptación): el tipo existe en esta residencia, está activo y su disponibilidad la admite (docs/04 §10, DR69).
 */
export async function loadRequestableRoomType(
  admin: SupabaseClient,
  residenceId: string,
  roomTypeId: string,
): Promise<RequestableRoomType> {
  const { data: roomType } = await admin
    .from("room_types")
    .select("id, monthly_price_usd, is_active, profile_availability(status, hidden_from_search_at)")
    .eq("id", roomTypeId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (!roomType || !roomType.is_active) {
    return { ok: false, error: "Ese tipo de habitación ya no está disponible." };
  }
  // profile_availability tiene unique(room_type_id): PostgREST devuelve un objeto singular en el embed.
  const availability = roomType.profile_availability as unknown as {
    status: string;
    hidden_from_search_at: string | null;
  } | null;
  const blocked = requestBlockedMessage(typeAvailabilityState(availability?.status), !!availability?.hidden_from_search_at);
  if (blocked) return { ok: false, error: blocked };
  return { ok: true, roomType: { id: roomType.id as string, monthlyPriceUsd: Number(roomType.monthly_price_usd) } };
}
