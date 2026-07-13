import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";

export const metadata: Metadata = { title: "Reservas" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  pending_estured_fee: { label: "Fee pendiente", tone: "amber" },
  estured_fee_processing: { label: "Procesando fee", tone: "amber" },
  estured_fee_failed: { label: "Fee falló", tone: "rose" },
  expired_fee_unpaid: { label: "Fee vencido", tone: "rose" },
  confirmed: { label: "Confirmada", tone: "emerald" },
  receipt_pending: { label: "Comprobante pendiente", tone: "amber" },
  receipt_issued: { label: "Comprobante emitido", tone: "emerald" },
  cancelled_by_student: { label: "Cancelada (estudiante)", tone: "neutral" },
  cancelled_by_residence: { label: "Cancelada (residencia)", tone: "neutral" },
  no_show: { label: "No-show", tone: "rose" },
  completed: { label: "Completada", tone: "emerald" },
  disputed: { label: "En disputa", tone: "rose" },
};

const ACTIVE_STATUSES = ["pending_estured_fee", "estured_fee_processing", "confirmed", "receipt_pending", "receipt_issued"];

type ReservationRow = {
  id: string;
  status: string;
  start_date: string;
  confirmed_at: string | null;
  created_at: string;
  student_profiles: { first_name: string; last_initial: string } | null;
  residences: { name: string; public_area: string | null } | null;
  room_types: { name: string } | null;
};

export default async function AdminReservationsPage() {
  const admin = getSupabaseAdmin();

  const { data, error } = admin
    ? await admin
        .from("reservations")
        .select(
          "id, status, start_date, confirmed_at, created_at, student_profiles(first_name, last_initial), residences(name, public_area), room_types(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };
  if (error) console.error("[admin/reservations] query failed:", error);
  const reservations = (data as unknown as ReservationRow[]) ?? [];
  const activeCount = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Reservas
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {reservations.length} en total, todas las residencias. Vista de solo lectura.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Alta", "Estudiante", "Residencia", "Tipo", "Ingreso", "Confirmada", "Estado"].map((h) => (
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
            {reservations.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.student_profiles ? `${r.student_profiles.first_name} ${r.student_profiles.last_initial}.` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.residences?.name}
                    {r.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {r.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.room_types?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {r.start_date}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString("es-AR") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reservations.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay reservas en el sistema.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
