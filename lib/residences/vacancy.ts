import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVacancyOutlook, type VacancyOutlook } from "@/lib/applications/emptyMonths";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";

const UNKNOWN: VacancyOutlook = { availableFrom: null, hasOccupancyData: false, fullRanges: [], horizonEnd: null };

/**
 * Vacancia por tipo de habitación para el mes vacío (`confirmedEmptyMonthsCharge`). La disponibilidad publicada (`profile_availability`)
 * define desde cuándo está vacante la plaza (Premium y no Premium por igual); la ocupación real (solo Premium) descarta tramos ocupados.
 * Ante cualquier error de lectura el tipo queda sin dato (no se cobra, queda «a confirmar»).
 */
export async function loadVacancyOutlooks(
  admin: SupabaseClient,
  residenceId: string,
  roomTypeIds: string[],
  today: string,
): Promise<Record<string, VacancyOutlook>> {
  const result: Record<string, VacancyOutlook> = Object.fromEntries(roomTypeIds.map((id) => [id, UNKNOWN]));
  if (roomTypeIds.length === 0) return result;
  try {
    const [residenceRes, typesRes, roomsRes, staysRes, reservationsRes, availabilityRes] = await Promise.all([
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
      admin
        .from("profile_availability")
        .select("room_type_id, status, available_from, hidden_from_search_at")
        .eq("residence_id", residenceId)
        .in("room_type_id", roomTypeIds),
    ]);
    if (residenceRes.error || typesRes.error || roomsRes.error || staysRes.error || reservationsRes.error || availabilityRes.error) return result;
    const premium = residenceRes.data?.has_operational_management_access === true;
    const stays = staysRes.data ?? [];
    // Una estadía vigente sin tipo no se puede asignar a ninguno: la ocupación real de la residencia deja de ser confiable.
    // Ante esa duda no se cobra: se devuelve «a confirmar» para todos los tipos (no se degrada a «solo disponibilidad publicada»).
    if (stays.some((s) => !s.room_type_id)) return result;
    const linkedReservationIds = new Set(stays.map((s) => s.reservation_id as string | null).filter(Boolean));
    for (const typeId of roomTypeIds) {
      const type = { id: typeId, capacity_per_room: (typesRes.data ?? []).find((t) => t.id === typeId)?.capacity_per_room };
      const perRoom = Math.max(1, Math.floor(Number(type.capacity_per_room) || 1));
      const roomCount = (roomsRes.data ?? []).filter((r) => r.room_type_id === type.id).length;
      // Disponibilidad publicada (Premium y no Premium por igual): estado «disponible a confirmar» y no oculta de la búsqueda.
      const availability = (availabilityRes.data ?? []).find((a) => a.room_type_id === type.id);
      const published = availability?.status === "available_to_confirm" && !availability.hidden_from_search_at;
      const availableFrom = published ? ((availability?.available_from as string | null) ?? today) : null;
      result[type.id as string] = buildVacancyOutlook({
        today,
        availableFrom,
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
