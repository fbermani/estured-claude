import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { ReopenApplicationControl } from "@/app/admin/applications/ReopenApplicationControl";

export const metadata: Metadata = { title: "Solicitudes" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  submitted: { label: "Nueva", tone: "amber" },
  queued_for_place: { label: "En cola", tone: "neutral" },
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "emerald" },
  offer_pending_student_acceptance: { label: "Propuesta enviada", tone: "amber" },
  conditions_accepted: { label: "Condiciones aceptadas", tone: "emerald" },
  residence_payment_pending: { label: "Esperando pago", tone: "amber" },
  residence_payment_reported: { label: "Pago recibido", tone: "emerald" },
  converted_to_reservation: { label: "Reserva creada", tone: "emerald" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "rose" },
  expired_no_residence_response: { label: "Vencida", tone: "neutral" },
  cancelled_by_student: { label: "Cancelada", tone: "neutral" },
};

const CLOSED_STATUSES = ["converted_to_reservation", "rejected", "expired_no_residence_response", "cancelled_by_student"];
const REOPENABLE_STATUSES = ["rejected", "expired_no_residence_response"];

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
  const activeCount = applications.filter((a) => !CLOSED_STATUSES.includes(a.status)).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Solicitudes
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {applications.length} en total, todas las residencias. Cada residencia gestiona
        sus propias solicitudes desde su panel — desde acá solo se puede reabrir una rechazada o vencida.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Estudiante", "Residencia", "Tipo", "Ingreso deseado", "Estado", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: cmd.outline }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.submitted;
              return (
                <tr key={a.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {new Date(a.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {a.student_profiles ? `${a.student_profiles.first_name} ${a.student_profiles.last_initial}.` : "—"}
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
                    {a.desired_start_date}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {REOPENABLE_STATUSES.includes(a.status) && <ReopenApplicationControl applicationId={a.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
