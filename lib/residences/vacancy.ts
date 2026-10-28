import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVacancyOutlook, type VacancyOutlook } from "@/lib/applications/emptyMonths";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";

const UNRELIABLE: VacancyOutlook = { reliable: false, emptyMonthKeys: [] };

/**
 * Ocupación futura por tipo de habitación para el cálculo del mes vacío confirmado (`confirmedEmptyMonthsCharge`). Solo con Gestión
 * Operativa (Premium) hay dato confiable; ante cualquier error de lectura el tipo queda «no confiable» (no se cobra, queda «a confirmar»).
 * `profile_availability` es declarativa e informativa y NO se usa para cobrar.
 */
export async function loadVacancyOutlooks(
  admin: SupabaseClient,
  residenceId: string,
  roomTypeIds: string[],
  today: string,
): Promise<Record<string, VacancyOutlook>> {
  const result: Record<string, VacancyOutlook> = Object.fromEntries(roomTypeIds.map((id) => [id, UNRELIABLE]));
  if (roomTypeIds.length === 0) return result;
  try {
    const [residenceRes, typesRes, roomsRes, staysRes, reservationsRes] = await Promise.all([
      admin.from("residences").select("has_operational_management_access").eq("id", residenceId).maybeSingle(),
      admin.from("room_types").select("id, capacity_per_room").eq("residence_id", residenceId).in("id", roomTypeIds),
      admin.from("rooms").select("room_type_id").eq("residence_id", residenceId).eq("is_active", true),
      admin
        .from("resident_stays")
        .select("room_type_id, start_date, end_date, reservation_id")
        .eq("residence_id", residenceId)
        .eq("is_current", true)
        .neq("status", "inactive"),
      admin
        .from("reservations")
        .select("id, room_type_id, start_date, initial_duration_months")
        .eq("residence_id", residenceId)
        .in("room_type_id", roomTypeIds)
        // Reservas vigentes (incluye `disputed` y `estured_fee_failed`, que siguen ocupando plaza).
        .in("status", [...LIVE_RESERVATION_STATUSES]),
    ]);
    if (residenceRes.error || typesRes.error || roomsRes.error || staysRes.error || reservationsRes.error) return result;
    const premium = residenceRes.data?.has_operational_management_access === true;
    const stays = staysRes.data ?? [];
    // Una estadía vigente sin tipo no se puede asignar a ninguno: la ocupación de la residencia deja de ser confiable.
    if (stays.some((s) => !s.room_type_id)) return result;
    const linkedReservationIds = new Set(stays.map((s) => s.reservation_id as string | null).filter(Boolean));
    for (const type of typesRes.data ?? []) {
      const perRoom = Math.max(1, Math.floor(Number(type.capacity_per_room) || 1));
      const roomCount = (roomsRes.data ?? []).filter((r) => r.room_type_id === type.id).length;
      result[type.id as string] = buildVacancyOutlook({
        today,
        premium,
        capacity: roomCount * perRoom,
        residenceHasStays: stays.length > 0,
        stays: stays
          .filter((s) => s.room_type_id === type.id)
          .map((s) => ({ startDate: (s.start_date as string | null) ?? null, endDate: (s.end_date as string | null) ?? null })),
        reservations: (reservationsRes.data ?? [])
          .filter((r) => r.room_type_id === type.id && !linkedReservationIds.has(r.id as string))
          .map((r) => ({
            startDate: (r.start_date as string | null) ?? null,
            durationMonths: r.initial_duration_months == null ? null : Number(r.initial_duration_months),
          })),
      });
    }
  } catch (error) {
    console.error("[vacancy] lectura fallida:", error);
  }
  return result;
}
