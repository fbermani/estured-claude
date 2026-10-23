import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { RESIDENCE_STATUS_BADGE } from "@/app/admin/residences/statusBadge";
import { formatDate } from "@/lib/dates/format";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatShortName } from "@/lib/format/shortName";
import { formatUsd } from "@/lib/mock/exchange";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { getStaleAvailabilityByResidence, staleAvailabilityMessage } from "@/lib/residences/staleAvailability";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getResidenceLocation } from "@/lib/residences/residenceLocation";
import { ResidenceLocationForm } from "@/app/admin/residences/[id]/ResidenceLocationForm";

export const metadata: Metadata = { title: "Detalle de residencia" };
export const dynamic = "force-dynamic";

const AVAILABILITY_LABEL: Record<string, { label: string; tone: "emerald" | "neutral" | "amber" | "rose" }> = {
  available_to_confirm: { label: "Disponible", tone: "emerald" },
  full: { label: "Completa", tone: "neutral" },
  not_updated: { label: "Sin actualizar", tone: "amber" },
  paused_by_residence: { label: "Pausada por la residencia", tone: "neutral" },
  paused_by_admin: { label: "Pausada por EstuRed", tone: "rose" },
};

const SUPPORT_STATUS_LABEL: Record<string, string> = {
  opened: "Abierto",
  submitted: "Enviado",
  under_review: "En revisión",
  needs_more_info: "Necesitamos más info",
  waiting_other_party: "Esperando a la otra parte",
  in_progress: "En curso",
  resolved_by_agreement: "Resuelto por acuerdo",
  closed_no_action: "Cerrado sin acción",
  closed_unresolved: "Cerrado sin resolución",
  admin_action_taken: "Acción tomada",
};
const OPEN_SUPPORT_STATUSES = ["opened", "submitted", "under_review", "needs_more_info", "waiting_other_party", "in_progress"];

type RoomTypeRow = {
  id: string;
  name: string;
  monthly_price_usd: number;
  profile_availability: {
    status: string;
    available_count: number | null;
    last_confirmed_at: string;
    hidden_from_search_at: string | null;
  } | null;
};

type ReservationRow = {
  id: string;
  status: string;
  start_date: string;
  created_at: string;
  cancellation_reason_code: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  room_types: { name: string } | null;
};

type SupportRow = { id: string; status: string; description: string; created_at: string };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt style={{ color: cmd.outline }}>{label}</dt>
      <dd className="text-right font-medium" style={{ color: cmd.onSurface }}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Vista de detalle de una residencia para el admin (auditoría 2026-10-20,
 * H25; docs/08 §8): reúne estado, disponibilidad, ocupación, reservas y
 * casos de Soporte. Solo lee datos que ya existen — no agrega acciones (las
 * de pausar y acceso operativo siguen en la lista de residencias).
 */
export default async function AdminResidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: residence, error: residenceError } = await admin
    .from("residences")
    .select("id, name, public_area, status, created_at, has_operational_management_access, pioneer_free_access_until, slug")
    .eq("id", id)
    .maybeSingle();
  if (residenceError) console.error("[admin/residences/[id]] residence lookup failed:", residenceError);
  if (!residence) notFound();

  // Aparte del select principal: si la migración 0042 todavía no está aplicada, este select falla
  // (columnas inexistentes) y la página igual tiene que abrir (la tarjeta de ubicación queda sin datos).
  const { data: locationRow, error: locationError } = await admin
    .from("residences")
    .select("latitude, longitude")
    .eq("id", id)
    .maybeSingle();
  const locationAvailable = !locationError;
  const storedLat = locationRow?.latitude != null ? Number(locationRow.latitude) : null;
  const storedLng = locationRow?.longitude != null ? Number(locationRow.longitude) : null;
  const mapLocation = getResidenceLocation({ latitude: storedLat, longitude: storedLng, public_area: residence.public_area });

  const { data: activeRooms } = await admin.from("rooms").select("id").eq("residence_id", id).eq("is_active", true);
  const roomIds = (activeRooms ?? []).map((r) => r.id);

  const [
    roomTypesResult,
    bedsResult,
    occupiedResult,
    residentsResult,
    reservationsResult,
    supportResult,
    staleMap,
    verificationResult,
  ] = await Promise.all([
    admin
      .from("room_types")
      .select("id, name, monthly_price_usd, profile_availability (status, available_count, last_confirmed_at, hidden_from_search_at)")
      .eq("residence_id", id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    roomIds.length > 0
      ? admin.from("beds").select("*", { count: "exact", head: true }).in("room_id", roomIds).eq("status", "active")
      : Promise.resolve({ count: 0 }),
    admin
      .from("resident_stays")
      .select("*", { count: "exact", head: true })
      .eq("residence_id", id)
      .eq("is_current", true)
      .not("bed_id", "is", null),
    admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", id).eq("is_current", true),
    admin
      .from("reservations")
      .select("id, status, start_date, created_at, cancellation_reason_code, student_profiles(first_name, last_initial), room_types(name)")
      .eq("residence_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("support_cases")
      .select("id, status, description, created_at")
      .eq("residence_id", id)
      .order("created_at", { ascending: false })
      .limit(6),
    getStaleAvailabilityByResidence(admin, [id]),
    admin
      .from("residence_verifications")
      .select("status, expires_at")
      .eq("residence_id", id)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const [label, result] of [
    ["room_types", roomTypesResult],
    ["reservations", reservationsResult],
    ["support_cases", supportResult],
    ["residence_verifications", verificationResult],
  ] as const) {
    if (result.error) console.error(`[admin/residences/[id]] ${label} lookup failed:`, result.error);
  }
  const verificationExpiresAt = (verificationResult.data as { expires_at: string | null } | null)?.expires_at ?? null;

  const roomTypes = (roomTypesResult.data as unknown as RoomTypeRow[]) ?? [];
  const reservations = (reservationsResult.data as unknown as ReservationRow[]) ?? [];
  const supportCases = (supportResult.data as unknown as SupportRow[]) ?? [];
  const capacity = bedsResult.count ?? 0;
  const occupied = occupiedResult.count ?? 0;
  const openSupport = supportCases.filter((c) => OPEN_SUPPORT_STATUSES.includes(c.status)).length;
  const staleNotice = staleAvailabilityMessage(staleMap.get(id));
  const badge = RESIDENCE_STATUS_BADGE[residence.status] ?? { label: "Estado en revisión", tone: "neutral" as const };

  return (
    <div className="p-8">
      <Link href="/admin/residences" className="text-sm font-bold hover:underline" style={{ color: cmd.primary }}>
        ← Residencias
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
            {residence.name}
          </h1>
          <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
            {residence.public_area ?? "Zona sin definir"}, CABA
          </p>
        </div>
        <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
      </div>

      {staleNotice && (
        <div
          role="alert"
          className="mt-4 rounded-[14px] px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: cmd.amberBg, color: cmd.amber }}
        >
          {staleNotice}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard className="p-5">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Estado y verificación
          </h2>
          <dl className="mt-2 divide-y" style={{ borderColor: cmd.border }}>
            <Row label="Alta">{formatDate(residence.created_at)}</Row>
            <Row label="Verificación vigente hasta">{verificationExpiresAt ? formatDate(verificationExpiresAt) : "—"}</Row>
            <Row label="Gestión Operativa">
              {residence.has_operational_management_access ? "Con acceso" : "Sin acceso"}
              {residence.pioneer_free_access_until && (
                <span className="block text-xs font-normal" style={{ color: cmd.outline }}>
                  Hasta {formatDateOnly(residence.pioneer_free_access_until)}
                </span>
              )}
            </Row>
            <Row label="Ficha pública">
              {residence.status === "verified_active" && residence.slug ? (
                <Link href={`/residencias/${residence.slug}`} className="font-bold hover:underline" style={{ color: cmd.primary }}>
                  Ver ficha →
                </Link>
              ) : (
                "No publicada"
              )}
            </Row>
          </dl>
        </AdminCard>

        <AdminCard className="p-5">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Ocupación
          </h2>
          <p className="mt-3 text-[28px] font-bold" style={{ color: cmd.onSurface }}>
            {occupied}
            <span className="text-base font-medium" style={{ color: cmd.outline }}>
              {capacity > 0 ? ` / ${capacity} plazas` : " plazas ocupadas"}
            </span>
          </p>
          <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
            {residentsResult.count ?? 0} residentes cargados · {openSupport} caso(s) de Soporte abierto(s)
          </p>
        </AdminCard>
      </div>

      <AdminCard className="mt-4 p-5">
        <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
          Ubicación en el mapa público
        </h2>
        <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
          Mapa de la ficha:{" "}
          {mapLocation.source === "residence" ? (
            <span className="font-semibold" style={{ color: cmd.onSurfaceVariant }}>
              pin en {mapLocation.lat}, {mapLocation.lng}
            </span>
          ) : (
            <span className="font-semibold" style={{ color: cmd.onSurfaceVariant }}>
              sin coordenada cargada: se muestra la ubicación aproximada del barrio
            </span>
          )}
        </p>
        {locationAvailable ? (
          <ResidenceLocationForm residenceId={residence.id} latitude={storedLat} longitude={storedLng} />
        ) : (
          <p className="mt-3 text-sm" style={{ color: cmd.amber }}>
            Falta aplicar la migración 0042 (coordenadas de residencias) en esta base.
          </p>
        )}
      </AdminCard>

      <AdminCard className="mt-4 overflow-hidden">
        <h2 className="px-5 pt-5 text-sm font-bold" style={{ color: cmd.onSurface }}>
          Disponibilidad por tipo de habitación
        </h2>
        {roomTypes.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: cmd.outline }}>
            Todavía no tiene tipos de habitación cargados.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
                <tr>
                  {["Tipo", "Tarifa", "Disponibilidad", "Lugares", "Última actualización"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => {
                  const av = rt.profile_availability;
                  const label = av ? (AVAILABILITY_LABEL[av.status] ?? { label: "Estado en revisión", tone: "neutral" as const }) : null;
                  return (
                    <tr key={rt.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                        {rt.name}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: cmd.onSurfaceVariant }}>
                        {formatUsd(Number(rt.monthly_price_usd))}/mes
                      </td>
                      <td className="px-4 py-2.5">
                        {label ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <AdminBadge tone={label.tone}>{label.label}</AdminBadge>
                            {av?.hidden_from_search_at && <AdminBadge tone="rose">Oculta de las búsquedas</AdminBadge>}
                          </div>
                        ) : (
                          <span style={{ color: cmd.outline }}>Sin cargar</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                        {av?.available_count ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: cmd.outline }}>
                        {av ? formatDate(av.last_confirmed_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard className="overflow-hidden">
          <h2 className="px-5 pt-5 text-sm font-bold" style={{ color: cmd.onSurface }}>
            Reservas recientes
          </h2>
          {reservations.length === 0 ? (
            <p className="p-5 text-sm" style={{ color: cmd.outline }}>
              Todavía no tiene reservas.
            </p>
          ) : (
            <ul className="mt-2">
              {reservations.map((r) => {
                const visible = getVisibleStatus({
                  applicationStatus: "converted_to_reservation",
                  reservation: { status: r.status, cancellationReasonCode: r.cancellation_reason_code },
                  viewer: "admin",
                });
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm" style={{ borderTop: `1px solid ${cmd.border}` }}>
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ color: cmd.onSurface }}>
                        {formatShortName(r.student_profiles?.first_name, r.student_profiles?.last_initial) || "Estudiante"}
                      </p>
                      <p className="truncate text-xs" style={{ color: cmd.outline }}>
                        {r.room_types?.name ?? "—"} · Ingreso {formatDateOnly(r.start_date)}
                      </p>
                    </div>
                    <AdminBadge tone={visible.tone === "sage" ? "emerald" : visible.tone === "amber" ? "amber" : visible.tone === "danger" ? "rose" : "neutral"}>
                      {visible.label}
                    </AdminBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>

        <AdminCard className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
              Casos de Soporte
            </h2>
            <Link href="/admin/support-cases" className="text-xs font-bold hover:underline" style={{ color: cmd.primary }}>
              Ver todos
            </Link>
          </div>
          {supportCases.length === 0 ? (
            <p className="p-5 text-sm" style={{ color: cmd.outline }}>
              No tiene casos de Soporte.
            </p>
          ) : (
            <ul className="mt-2">
              {supportCases.map((c) => (
                <li key={c.id} style={{ borderTop: `1px solid ${cmd.border}` }}>
                  <Link href={`/admin/support-cases?id=${c.id}`} className="block px-5 py-2.5 text-sm hover:bg-black/[0.02]">
                    <div className="flex items-center justify-between gap-3">
                      <AdminBadge tone={OPEN_SUPPORT_STATUSES.includes(c.status) ? "amber" : "neutral"}>
                        {SUPPORT_STATUS_LABEL[c.status] ?? "Estado en revisión"}
                      </AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: cmd.onSurfaceVariant }}>
                      {c.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
