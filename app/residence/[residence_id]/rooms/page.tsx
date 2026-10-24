import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { RoomsBrowser, type RoomsData } from "@/app/residence/[residence_id]/rooms/RoomsBrowser";

export const metadata: Metadata = { title: "Habitaciones" };
export const dynamic = "force-dynamic";

const VISIBLE_STAY_STATUSES = ["created_by_residence", "pending_activation", "active", "visibility_limited"];

/**
 * Módulo de habitaciones — a semejanza de la referencia
 * `estured_admin_habitaciones_dashboard_full_page`: KPIs, filtros por
 * tipo, grupos con tarifa base y cards por habitación con ocupantes y
 * camas libres; el modal de gestión replica
 * `estured_admin_gesti_n_de_habitaciones` (plazas A/B/C… con estado).
 */
export default async function ResidenceRoomsPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect(`/login?next=/residence/${residenceId}/rooms`);

  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const [{ data: roomTypes }, { data: rooms }, { data: stays }, rate] = await Promise.all([
    admin
      .from("room_types")
      .select("id, name, gender_policy, bathroom_type, capacity_per_room, monthly_price_usd")
      .eq("residence_id", residenceId)
      .eq("is_active", true),
    admin
      .from("rooms")
      .select("id, label, room_type_id, sort_order")
      .eq("residence_id", residenceId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("resident_stays")
      .select(
        "id, status, room_id, bed_id, room_type_id, invite_email, start_date, expected_end_date, student_profiles(first_name, last_initial, nationality, country_flag)",
      )
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .in("status", VISIBLE_STAY_STATUSES),
    getCurrentExchangeRate(),
  ]);

  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: beds } = roomIds.length
    ? await admin.from("beds").select("id, room_id, letter, status, out_of_service_reason, sort_order").in("room_id", roomIds).order("sort_order", { ascending: true })
    : { data: [] };

  // Disponibilidad declarada por tipo — para poder editarla desde el
  // modal de la habitación (Ciclo 41), sin ir a /availability.
  const typeIds = (roomTypes ?? []).map((t) => t.id);
  const { data: availabilityRows } = typeIds.length
    ? await admin
        .from("profile_availability")
        .select("room_type_id, status, available_count, available_from, notes_public")
        .in("room_type_id", typeIds)
    : { data: [] };
  const availabilityByType = new Map((availabilityRows ?? []).map((a) => [a.room_type_id, a]));

  // Renovaciones activas (para "movimientos próximos").
  const [{ count: renewalRequests }, { count: renewalOffers }] = await Promise.all([
    admin
      .from("renewal_requests")
      .select("*", { count: "exact", head: true })
      .eq("residence_id", residenceId)
      .in("status", ["created_by_student", "notified_to_residence"]),
    admin
      .from("renewal_offers")
      .select("*", { count: "exact", head: true })
      .eq("residence_id", residenceId)
      .in("status", ["sent", "viewed"]),
  ]);

  const stayName = (s: {
    invite_email: string | null;
    student_profiles: unknown;
  }): { name: string; pending: boolean; flag: string | null; nationality: string | null } => {
    const profile = s.student_profiles as
      | { first_name: string; last_initial: string; nationality: string | null; country_flag: string | null }
      | null;
    if (profile)
      return {
        name: `${formatShortName(profile.first_name, profile.last_initial)}`,
        pending: false,
        flag: profile.country_flag,
        nationality: profile.nationality,
      };
    return { name: "Residente sin activar", pending: true, flag: null, nationality: null };
  };

  const staysByBed = new Map<string, (typeof stays extends (infer T)[] | null ? T : never)>();
  const unassigned: RoomsData["unassigned"] = [];
  for (const s of stays ?? []) {
    if (s.bed_id) staysByBed.set(s.bed_id, s);
    else {
      const { name, pending } = stayName(s);
      unassigned.push({ stayId: s.id, name, pending, roomTypeId: s.room_type_id });
    }
  }

  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);

  const groups: RoomsData["groups"] = (roomTypes ?? [])
    .map((rt) => {
      const typeRooms = (rooms ?? [])
        .filter((r) => r.room_type_id === rt.id)
        .map((room) => ({
          id: room.id,
          label: room.label,
          beds: (beds ?? [])
            .filter((b) => b.room_id === room.id)
            .map((b) => {
              const stay = staysByBed.get(b.id);
              return {
                id: b.id,
                letter: b.letter,
                status: b.status as "active" | "out_of_service",
                reason: b.out_of_service_reason,
                occupant: stay
                  ? {
                      stayId: stay.id,
                      ...stayName(stay),
                      until: stay.expected_end_date,
                    }
                  : null,
              };
            }),
        }));
      const availability = availabilityByType.get(rt.id) ?? null;
      return {
        id: rt.id,
        name: rt.name,
        genderPolicy: rt.gender_policy,
        bathroomType: rt.bathroom_type,
        capacityPerRoom: Math.max(1, rt.capacity_per_room ?? 1),
        priceUsd: Number(rt.monthly_price_usd),
        rooms: typeRooms,
        availability: availability
          ? {
              status: availability.status,
              availableCount: availability.available_count,
              availableFrom: availability.available_from,
              notesPublic: availability.notes_public,
            }
          : null,
      };
    })
    .filter((g) => g.rooms.length > 0);

  const allBeds = beds ?? [];
  const activeBeds = allBeds.filter((b) => b.status === "active");
  const occupiedBeds = allBeds.filter((b) => staysByBed.has(b.id));
  const freeActive = activeBeds.filter((b) => !staysByBed.has(b.id));
  const kpis: RoomsData["kpis"] = {
    roomsCount: (rooms ?? []).length,
    bedsCount: allBeds.length,
    occupiedCount: occupiedBeds.length,
    outOfServiceCount: allBeds.length - activeBeds.length,
    vacantTotal: freeActive.length,
    upcomingArrivals: (stays ?? []).filter((s) => s.start_date && s.start_date > todayStr).length,
    upcomingDepartures: (stays ?? []).filter(
      (s) => s.expected_end_date && s.expected_end_date >= todayStr && s.expected_end_date <= in30Str,
    ).length,
    activeRenewals: (renewalRequests ?? 0) + (renewalOffers ?? 0),
  };

  return (
    <RoomsBrowser
      residenceId={residenceId}
      data={{ groups, unassigned, kpis }}
      arsPerUsd={rate.arsPerUsd}
    />
  );
}
