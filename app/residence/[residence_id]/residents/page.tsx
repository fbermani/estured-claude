import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { ResidentsBrowser, type ResidentsData } from "@/app/residence/[residence_id]/residents/ResidentsBrowser";

export const metadata: Metadata = { title: "Residentes" };
export const dynamic = "force-dynamic";

/**
 * Módulo de residentes — a semejanza de la referencia
 * `estured_admin_gesti_n_de_residentes`: KPIs, buscador con pills de
 * estado y tabla (Residente · Habitación/Cama · Estado · Contrato hasta
 * · Tarifa) con panel de gestión por fila (ref
 * `estured_admin_modal_perfil_del_residente`). Sin "evaluaciones" ni
 * "señales" (feature pospuesta por el dueño) y sin notas internas
 * (pendiente, próximo ciclo).
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

  const [{ data: stays, error }, { data: roomTypes }, { data: rooms }, renewals] = await Promise.all([
    admin
      .from("resident_stays")
      .select(
        "id, status, invite_email, start_date, expected_end_date, monthly_rate_usd, room_id, bed_id, room_types(id, name, monthly_price_usd), student_profiles(first_name, last_initial, country_flag)",
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
      room_types: { id: string; name: string; monthly_price_usd: number } | null;
      student_profiles: { first_name: string; last_initial: string; country_flag: string | null } | null;
    }[]) ?? [];

  const rows: ResidentsData["rows"] = rawStays.map((s) => {
    const room = s.room_id ? roomById.get(s.room_id) : null;
    const bed = s.bed_id ? bedById.get(s.bed_id) : null;
    const pending = !s.student_profiles;
    return {
      stayId: s.id,
      name: s.student_profiles
        ? `${s.student_profiles.first_name} ${s.student_profiles.last_initial}.`
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
      }}
    />
  );
}
