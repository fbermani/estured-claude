import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { cmd } from "@/components/admin/ui/tokens";
import { ReopenApplicationControl } from "@/app/admin/applications/ReopenApplicationControl";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Solicitudes" };
export const dynamic = "force-dynamic";

/** Tono de `getVisibleStatus` (sage/danger) → tono del sistema de badges del admin (emerald/rose). */
const ADMIN_TONE = { amber: "amber", sage: "emerald", neutral: "neutral", danger: "rose" } as const;

const CLOSED_STATUSES = [
  "converted_to_reservation",
  "rejected",
  "expired_no_residence_response",
  "expired_offer_no_response",
  "cancelled_by_student",
];
const REOPENABLE_STATUSES = ["rejected", "expired_no_residence_response", "expired_offer_no_response"];

type ApplicationRow = {
  id: string;
  status: string;
  desired_start_date: string;
  created_at: string;
  student_profiles: { first_name: string; last_initial: string } | null;
  residences: { name: string; public_area: string | null } | null;
  room_types: { name: string } | null;
};

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const admin = getSupabaseAdmin();

  const { data, error } = admin
    ? await admin
        .from("application_requests")
        .select(
          "id, status, desired_start_date, created_at, student_profiles(first_name, last_initial), residences(name, public_area), room_types(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };
  if (error) console.error("[admin/applications] query failed:", error);
  const applications = (data as unknown as ApplicationRow[]) ?? [];
  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const reservationInfoByAppId = admin
    ? await loadReservationInfoByApplication(
        admin,
        applications.filter((a) => a.status === "converted_to_reservation").map((a) => a.id),
      )
    : new Map();
  const activeCount = applications.filter((a) => !CLOSED_STATUSES.includes(a.status)).length;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Solicitudes
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {applications.length} en total, todas las residencias. Cada residencia gestiona
        sus propias solicitudes desde su panel — desde acá solo se puede reabrir una rechazada o vencida.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <ul className="divide-y md:hidden" style={{ borderColor: cmd.border }} aria-label="Solicitudes">
          {applications.map((a) => {
            const visible = getVisibleStatus({
              applicationStatus: a.status,
              reservation: reservationInfoByAppId.get(a.id),
              viewer: "admin",
            });
            const badgeTone = visible.key === "rejected" ? "rose" : ADMIN_TONE[visible.tone];
            return (
              <li key={a.id} className="p-4 [&_button]:min-h-11 [&_button]:px-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium" style={{ color: cmd.onSurface }}>
                    {a.student_profiles ? formatShortName(a.student_profiles.first_name, a.student_profiles.last_initial) : "—"}
                  </p>
                  <div className="shrink-0">
                    <AdminBadge tone={badgeTone}>{visible.label}</AdminBadge>
                  </div>
                </div>
                <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  {a.residences?.name}
                  {a.residences?.public_area && (
                    <span className="block text-xs" style={{ color: cmd.outline }}>
                      {a.residences.public_area}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-xs" style={{ color: cmd.outline }}>
                  {a.room_types?.name ?? "—"} · Ingreso {formatDateOnly(a.desired_start_date)} · Enviada {formatDate(a.created_at)}
                </p>
                {REOPENABLE_STATUSES.includes(a.status) && (
                  <div className="mt-3 flex justify-end">
                    <ReopenApplicationControl applicationId={a.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block">
          <ScrollTable label="Solicitudes">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Estudiante", "Estado", "Residencia", "Tipo", "Ingreso deseado", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                  style={{ color: cmd.outline }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const visible = getVisibleStatus({
                applicationStatus: a.status,
                reservation: reservationInfoByAppId.get(a.id),
                viewer: "admin",
              });
              // La solicitud rechazada conserva el rojo que ya tenía en el admin.
              const badgeTone = visible.key === "rejected" ? "rose" : ADMIN_TONE[visible.tone];
              return (
                <tr key={a.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {formatDate(a.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {a.student_profiles ? `${formatShortName(a.student_profiles.first_name, a.student_profiles.last_initial)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badgeTone}>{visible.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {a.residences?.name}
                    {a.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {a.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {a.room_types?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {formatDateOnly(a.desired_start_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    {REOPENABLE_STATUSES.includes(a.status) && <ReopenApplicationControl applicationId={a.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
          </ScrollTable>
        </div>
        {applications.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay solicitudes en el sistema.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
