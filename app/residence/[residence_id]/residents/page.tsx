import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { ResidentsBrowser, type ResidentsData } from "@/app/residence/[residence_id]/residents/ResidentsBrowser";
import { RESIDENCE_OFFER_STATUS_COPY } from "@/lib/renewals/statusCopy";

const ACTIVE_OFFER_STATUSES = new Set(["draft", "sent", "viewed"]);
const PENDING_REQUEST_STATUSES = new Set(["created_by_student", "notified_to_residence"]);

export const metadata: Metadata = { title: "Residentes" };
export const dynamic = "force-dynamic";

/**
 * Módulo de residentes — a semejanza de la referencia
 * `estured_admin_gesti_n_de_residentes`: KPIs, buscador con pills de
 * estado y tabla (Residente · Habitación/Cama · Estado · Contrato hasta
 * · Tarifa) con panel de gestión por fila (ref
 * `estured_admin_modal_perfil_del_residente`, incluidas las Notas
 * Internas — migración 0026). Sin "evaluaciones" ni "señales" (feature
 * pospuesta por el dueño).
 */
export default async function ResidenceResidentsPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const [{ data: stays, error }, { data: roomTypes }, { data: rooms }, renewals, { data: notes }] = await Promise.all([
    admin
      .from("resident_stays")
      .select(
        "id, status, invite_email, start_date, expected_end_date, monthly_rate_usd, room_id, bed_id, reservation_id, room_types(id, name, monthly_price_usd), student_profiles(first_name, last_initial, country_flag)",
      )
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .order("created_at", { ascending: false }),
    admin.from("room_types").select("id, name, monthly_price_usd").eq("residence_id", residenceId).eq("is_active", true),
    admin
      .from("rooms")
      .select("id, label, room_type_id")
      .eq("residence_id", residenceId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    Promise.all([
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
    ]),
    admin
      .from("resident_notes")
      .select("id, resident_stay_id, category, body, created_at, users(email, primary_role)")
      .eq("residence_id", residenceId)
      .order("created_at", { ascending: false }),
  ]);
  if (error) console.error("[residence/residents] query failed:", error);

  const roomIds = (rooms ?? []).map((r) => r.id);
  const { data: beds } = roomIds.length
    ? await admin
        .from("beds")
        .select("id, room_id, letter, status")
        .in("room_id", roomIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const roomById = new Map((rooms ?? []).map((r) => [r.id, r]));
  const bedById = new Map((beds ?? []).map((b) => [b.id, b]));
  const typeById = new Map((roomTypes ?? []).map((t) => [t.id, t]));

  const rawStays =
    (stays as unknown as {
      id: string;
      status: string;
      invite_email: string | null;
      start_date: string | null;
      expected_end_date: string | null;
      monthly_rate_usd: number | null;
      room_id: string | null;
      bed_id: string | null;
      reservation_id: string | null;
      room_types: { id: string; name: string; monthly_price_usd: number } | null;
      student_profiles: { first_name: string; last_initial: string; country_flag: string | null } | null;
    }[]) ?? [];

  // Renovación por estadía, vía `resident_stays.reservation_id` (Ciclo 42):
  // renewal_requests/renewal_offers cuelgan de la reserva, no de la estadía.
  const linkedReservationIds = [...new Set(rawStays.map((s) => s.reservation_id).filter((id): id is string => !!id))];
  const [{ data: linkedReservations, error: linkedReservationsError }, { data: linkedRequests }, { data: linkedOffers }] = linkedReservationIds.length
    ? await Promise.all([
        admin
          .from("reservations")
          .select("id, status, application_snapshots(monthly_price_usd)")
          .in("id", linkedReservationIds),
        admin.from("renewal_requests").select("reservation_id, status").in("reservation_id", linkedReservationIds),
        admin
          .from("renewal_offers")
          .select("reservation_id, status, created_at")
          .in("reservation_id", linkedReservationIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  if (linkedReservationsError) console.error("[residence/residents] linked reservations lookup failed:", linkedReservationsError);
  const reservationStatusById = new Map((linkedReservations ?? []).map((r) => [r.id, r.status as string]));
  // Tarifa del snapshot aceptado en la reserva (H05 / D5): la tarifa de la estadía puede diferir, pero la
  // residencia ve la diferencia contra lo que el estudiante aceptó.
  const agreedRateByReservationId = new Map(
    (linkedReservations ?? []).map((r) => {
      const snap = r.application_snapshots as unknown as { monthly_price_usd: number } | null;
      return [r.id, snap?.monthly_price_usd != null ? Number(snap.monthly_price_usd) : null] as const;
    }),
  );
  const pendingRequestReservationIds = new Set(
    (linkedRequests ?? []).filter((r) => PENDING_REQUEST_STATUSES.has(r.status)).map((r) => r.reservation_id),
  );
  const latestOfferStatusByReservation = new Map<string, string>();
  for (const o of linkedOffers ?? []) {
    if (!latestOfferStatusByReservation.has(o.reservation_id)) latestOfferStatusByReservation.set(o.reservation_id, o.status);
  }

  const rows: ResidentsData["rows"] = rawStays.map((s) => {
    let renewal: ResidentsData["rows"][number]["renewal"] = null;
    if (s.reservation_id) {
      const offerStatus = latestOfferStatusByReservation.get(s.reservation_id);
      const offerCopy = offerStatus ? RESIDENCE_OFFER_STATUS_COPY[offerStatus] : null;
      renewal = {
        reservationId: s.reservation_id,
        reservationConfirmed: reservationStatusById.get(s.reservation_id) === "confirmed",
        hasActiveOffer: offerStatus ? ACTIVE_OFFER_STATUSES.has(offerStatus) : false,
        studentRequested: pendingRequestReservationIds.has(s.reservation_id),
        statusLabel: offerCopy?.label ?? (offerStatus ?? null),
        statusTone: offerCopy?.tone ?? "neutral",
      };
    }
    const room = s.room_id ? roomById.get(s.room_id) : null;
    const bed = s.bed_id ? bedById.get(s.bed_id) : null;
    const pending = !s.student_profiles;
    return {
      stayId: s.id,
      name: s.student_profiles
        ? `${formatShortName(s.student_profiles.first_name, s.student_profiles.last_initial)}`
        : (s.invite_email ?? "Residente"),
      flag: s.student_profiles?.country_flag ?? null,
      email: s.invite_email,
      pending,
      hiddenFromCommunity: s.status === "hidden_by_user",
      typeName: s.room_types?.name ?? null,
      roomLabel: room?.label ?? null,
      bedLetter: bed?.letter ?? null,
      startDate: s.start_date,
      expectedEndDate: s.expected_end_date,
      rateUsd: s.monthly_rate_usd != null ? Number(s.monthly_rate_usd) : null,
      baseRateUsd: s.room_types ? Number(s.room_types.monthly_price_usd) : null,
      agreedRateUsd: s.reservation_id ? (agreedRateByReservationId.get(s.reservation_id) ?? null) : null,
      renewal,
    };
  });

  const occupiedBedIds = new Set(rawStays.map((s) => s.bed_id).filter(Boolean));
  const freeBeds: ResidentsData["freeBeds"] = (beds ?? [])
    .filter((b) => b.status === "active" && !occupiedBedIds.has(b.id))
    .map((b) => {
      const room = roomById.get(b.room_id);
      const type = room ? typeById.get(room.room_type_id) : null;
      return { id: b.id, label: `${room?.label ?? "Habitación"} - ${b.letter}${type ? ` (${type.name})` : ""}` };
    });

  const rawNotes =
    (notes as unknown as {
      id: string;
      resident_stay_id: string;
      category: "general" | "pagos";
      body: string;
      created_at: string;
      users: { email: string; primary_role: string } | null;
    }[]) ?? [];
  const notesByStay: ResidentsData["notesByStay"] = {};
  for (const n of rawNotes) {
    const authorLabel =
      n.users?.primary_role === "residence_owner"
        ? "Dueño de residencia"
        : n.users?.primary_role === "residence_staff"
          ? "Staff de residencia"
          : (n.users?.email ?? "Staff");
    const list = notesByStay[n.resident_stay_id] ?? [];
    list.push({ id: n.id, category: n.category, body: n.body, createdAt: n.created_at, authorLabel });
    notesByStay[n.resident_stay_id] = list;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const kpis: ResidentsData["kpis"] = {
    active: rawStays.filter((s) => !["created_by_residence", "pending_activation"].includes(s.status)).length,
    arrivals: rawStays.filter((s) => s.start_date && s.start_date > todayStr).length,
    departures: rawStays.filter(
      (s) => s.expected_end_date && s.expected_end_date >= todayStr && s.expected_end_date <= in30Str,
    ).length,
    renewals: (renewals[0].count ?? 0) + (renewals[1].count ?? 0),
  };

  return (
    <ResidentsBrowser
      residenceId={residenceId}
      data={{
        rows,
        freeBeds,
        roomTypes: (roomTypes ?? []).map((t) => ({ id: t.id, name: t.name })),
        kpis,
        notesByStay,
      }}
    />
  );
}
