import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { cmd } from "@/components/admin/ui/tokens";
import { RemoveWaitlistEntryControl } from "@/app/admin/waitlists/RemoveWaitlistEntryControl";


const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  active: { label: "En espera", tone: "neutral" },
  availability_notification_sent: { label: "Avisado", tone: "amber" },
  retention_check_sent: { label: "Chequeo de retención", tone: "amber" },
  student_activated_request: { label: "Activó solicitud", tone: "emerald" },
  removed_by_student: { label: "Salió (estudiante)", tone: "neutral" },
  removed_due_to_confirmed_reservation: { label: "Salió (otra reserva)", tone: "neutral" },
  removed_by_residence: { label: "Sacado (residencia)", tone: "rose" },
  removed_by_admin: { label: "Sacado (admin)", tone: "rose" },
  closed_by_residence: { label: "Lista cerrada", tone: "neutral" },
};

type WaitlistRow = {
  id: string;
  status: string;
  joined_at: string;
  desired_start_date: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  residences: { name: string; public_area: string } | null;
  room_types: { name: string } | null;
};

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];

export async function WaitlistsView() {
  const admin = getSupabaseAdmin();

  const { data, error } = admin
    ? await admin
        .from("waitlist_entries")
        .select(
          "id, status, joined_at, desired_start_date, student_profiles (first_name, last_initial), residences (name, public_area), room_types (name)",
        )
        .order("joined_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };
  if (error) console.error("[admin/waitlists] query failed:", error);
  const entries = (data as unknown as WaitlistRow[]) ?? [];
  const activeCount = entries.filter((e) => ACTIVE_STATUSES.includes(e.status)).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Listas de espera
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} en espera activa de {entries.length} registro(s). Desde acá se puede sacar a alguien de una lista activa.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <ScrollTable label="Listas de espera">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Alta", "Estudiante", "Residencia", "Tipo", "Ingreso deseado", "Estado", ""].map((h) => (
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
            {entries.map((e) => {
              const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.active;
              return (
                <tr key={e.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {formatDate(e.joined_at)}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {e.student_profiles ? `${formatShortName(e.student_profiles.first_name, e.student_profiles.last_initial)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {e.residences?.name}
                    {e.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {e.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {e.room_types?.name ?? "Cualquiera"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {e.desired_start_date ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {ACTIVE_STATUSES.includes(e.status) && <RemoveWaitlistEntryControl waitlistEntryId={e.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ScrollTable>
        {entries.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay entradas en ninguna lista de espera.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
