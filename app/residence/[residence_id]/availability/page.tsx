import { formatDate } from "@/lib/dates/format";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { BackToProfileLink } from "@/components/residences/BackToProfileLink";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { PermissionGate } from "@/components/residences/PermissionGate";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/mock/exchange";
import { AvailabilityTypeEditor } from "@/app/residence/[residence_id]/availability/AvailabilityTypeEditor";
import { loadGenderAvailability } from "@/lib/availability/genderAvailabilityDb";
import {
  buildEditorRows,
  candidateGenders,
  roomGendersOfType,
  summarizeRoomsByGender,
  typeCountDrifted,
  type SuggestionRoom,
} from "@/lib/availability/genderAvailability";
import { effectiveRoomGender } from "@/lib/residences/roomGender";

export const metadata: Metadata = { title: "Disponibilidad" };
export const dynamic = "force-dynamic";

/** Estadías que ocupan una cama (mismos estados que la pantalla de Habitaciones). */
const OCCUPYING_STAY_STATUSES = ["created_by_residence", "pending_activation", "active", "visibility_limited"];

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  available_to_confirm: { label: "Disponible", tone: "sage" },
  full: { label: "Completa", tone: "neutral" },
  not_updated: { label: "Sin actualizar", tone: "amber" },
  paused_by_residence: { label: "Pausada por vos", tone: "neutral" },
  paused_by_admin: { label: "Pausada por EstuRed", tone: "danger" },
};

export default async function ResidenceAvailabilityPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR11: actualizar la disponibilidad requiere `operations.rooms_availability`; sin él se ve en solo lectura.
  const canEdit = can(membership, "operations.rooms_availability");

  const [typesRes, roomsRes, staysRes] = await Promise.all([
    admin
      .from("room_types")
      .select(
        "id, name, monthly_price_usd, gender_policy, capacity_per_room, profile_availability (status, available_count, available_from, notes_public, last_confirmed_at, hidden_from_search_at)",
      )
      .eq("residence_id", residenceId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    // "*": si la migración 0057 (columna gender) aún no está aplicada, no explota y degrada al género del tipo.
    admin.from("rooms").select("*").eq("residence_id", residenceId).eq("is_active", true),
    admin
      .from("resident_stays")
      .select("bed_id, room_type_id")
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .in("status", OCCUPYING_STAY_STATUSES),
  ]);
  if (typesRes.error) console.error("[residence/availability] query failed:", typesRes.error);
  if (roomsRes.error) console.error("[residence/availability] rooms query failed:", roomsRes.error);
  if (staysRes.error) console.error("[residence/availability] stays query failed:", staysRes.error);

  // profile_availability tiene `unique(room_type_id)` — PostgREST detecta
  // la relación 1:1 y devuelve un objeto singular en el embed, no un
  // array (a diferencia de la mayoría de los embeds de este proyecto).
  const rows =
    (typesRes.data as unknown as {
      id: string;
      name: string;
      monthly_price_usd: number;
      gender_policy: string | null;
      capacity_per_room: number | null;
      profile_availability: {
        status: string;
        available_count: number | null;
        available_from: string | null;
        notes_public: string | null;
        last_confirmed_at: string;
        hidden_from_search_at: string | null;
      } | null;
    }[]) ?? [];

  const rooms = (roomsRes.data ?? []) as { id: string; room_type_id: string; gender?: string | null }[];
  const roomIds = rooms.map((r) => r.id);
  const { data: bedsData } = roomIds.length
    ? await admin.from("beds").select("id, room_id, status").in("room_id", roomIds)
    : { data: [] as { id: string; room_id: string; status: string }[] };
  const occupiedBedIds = new Set(((staysRes.data ?? []) as { bed_id: string | null }[]).map((s) => s.bed_id).filter((id): id is string => !!id));
  const unassignedByType = new Map<string, number>();
  for (const s of (staysRes.data ?? []) as { bed_id: string | null; room_type_id: string | null }[]) {
    if (!s.bed_id && s.room_type_id) unassignedByType.set(s.room_type_id, (unassignedByType.get(s.room_type_id) ?? 0) + 1);
  }
  const bedsByRoom = new Map<string, { status: "active" | "out_of_service"; occupied: boolean }[]>();
  for (const b of (bedsData ?? []) as { id: string; room_id: string; status: string }[]) {
    const list = bedsByRoom.get(b.room_id) ?? [];
    list.push({ status: b.status === "out_of_service" ? "out_of_service" : "active", occupied: occupiedBedIds.has(b.id) });
    bedsByRoom.set(b.room_id, list);
  }

  // Detalle por género (migración 0075). Sin ella la pantalla funciona por tipo, como antes.
  const gendersLoaded = await loadGenderAvailability(
    admin,
    rows.map((rt) => rt.id),
  );
  const legacy = !gendersLoaded.schemaReady;
  const roomsHref = `/residence/${residenceId}/rooms`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <BackToProfileLink residenceId={residenceId} className="mb-2" />
      <ResidenceHero icon="bed" title="Disponibilidad" subtitle="Cuántos lugares ofrecés, por tipo de habitación y por género." />
      <p className="text-sm text-ink-soft">
        Acá informás cuántos lugares ofrecés, por tipo de habitación y por género. Partimos de las camas libres que ya cargaste en{" "}
        <Link href={roomsHref} className="font-semibold text-forest-700 hover:underline">
          Habitaciones
        </Link>
        : confirmá o ajustá cada número. Actualizala al menos cada 30 días — si no, se muestra como &ldquo;sin actualizar&rdquo; y después de 15
        días más deja de aparecer en las búsquedas.
      </p>
      {legacy && (
        <p className="mt-3 rounded-field bg-info-bg px-3 py-2 text-xs text-info-fg">
          La disponibilidad por género todavía no está habilitada en esta cuenta: por ahora se informa por tipo de habitación.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <Card className="p-5">
            <p className="text-sm text-ink-soft">
              Todavía no cargaste tipos de habitación. Definilos en{" "}
              <Link href={`/residence/${residenceId}/profile`} className="font-semibold text-forest-700 hover:underline">
                el perfil de la residencia
              </Link>
              .
            </p>
          </Card>
        )}
        {rows.map((rt) => {
          const availability = rt.profile_availability;
          const badge = availability
            ? STATUS_COPY[availability.status] ?? { label: availability.status, tone: "neutral" as const }
            : { label: "Sin disponibilidad cargada", tone: "neutral" as const };

          const typeRooms = rooms.filter((r) => r.room_type_id === rt.id);
          const type = { policy: rt.gender_policy, capacityPerRoom: rt.capacity_per_room };
          const suggestionRooms: SuggestionRoom[] = typeRooms.map((r) => ({
            gender: effectiveRoomGender({ roomGender: r.gender, typePolicy: rt.gender_policy, capacityPerRoom: rt.capacity_per_room }),
            beds: bedsByRoom.get(r.id) ?? [],
          }));
          const candidates = candidateGenders(roomGendersOfType(typeRooms, type), type);
          const stored = gendersLoaded.byType.get(rt.id) ?? [];
          const editorRows = legacy && !availability
            ? []
            : legacy
            ? buildEditorRows({
                candidates: ["mixto"],
                stored: availability
                  ? [
                      {
                        gender: "mixto",
                        status: availability.status === "full" || availability.status === "paused_by_residence" ? availability.status : "available_to_confirm",
                        availableCount: availability.available_count,
                        availableFrom: availability.available_from,
                        notesPublic: availability.notes_public,
                      },
                    ]
                  : [],
                summaries: [],
              })
            : buildEditorRows({ candidates, stored, summaries: summarizeRoomsByGender(suggestionRooms) });

          const unassigned = unassignedByType.get(rt.id) ?? 0;
          const driftNote =
            !legacy && availability && typeCountDrifted(availability.status, availability.available_count, stored)
              ? "El total de este tipo cambió desde tu última carga (una reserva confirmada o la salida de un residente). Revisá cada género y volvé a guardar."
              : null;

          return (
            <Card key={rt.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{rt.name}</p>
                  <p className="text-xs text-ink-faint">{formatUsd(Number(rt.monthly_price_usd))}/mes</p>
                  {availability && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Última actualización {formatDate(availability.last_confirmed_at)}
                      {availability.hidden_from_search_at && " · oculta de las búsquedas"}
                    </p>
                  )}
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              {unassigned > 0 && !legacy && (
                <p className="mt-3 text-xs text-ink-faint">
                  Hay {unassigned} {unassigned === 1 ? "residente" : "residentes"} de este tipo sin cama asignada: asignalos en{" "}
                  <Link href={roomsHref} className="font-semibold text-forest-700 hover:underline">
                    Habitaciones
                  </Link>{" "}
                  para que las camas libres sugeridas sean exactas.
                </p>
              )}
              {editorRows.length > 0 ? (
                <PermissionGate allowed={canEdit} className="mt-4">
                  <AvailabilityTypeEditor
                    residenceId={residenceId}
                    roomTypeId={rt.id}
                    typeName={rt.name}
                    rows={editorRows}
                    legacy={legacy}
                    roomsHref={roomsHref}
                    driftNote={driftNote}
                  />
                </PermissionGate>
              ) : (
                <p className="mt-3 text-sm text-ink-faint">Este tipo de habitación todavía no tiene disponibilidad cargada.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
