import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { cmd } from "@/components/admin/ui/tokens";
import { reopenCapReached } from "@/lib/payments/reopenCap";
import { ReopenFeeWindowControl } from "@/app/admin/reservations/ReopenFeeWindowControl";


const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  pending_estured_fee: { label: "Fee pendiente", tone: "amber" },
  estured_fee_processing: { label: "Procesando fee", tone: "amber" },
  estured_fee_failed: { label: "Fee falló", tone: "rose" },
  expired_fee_unpaid: { label: "Reserva vencida", tone: "rose" },
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
  estured_fee_payment_id: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  residences: { name: string; public_area: string | null } | null;
  room_types: { name: string } | null;
};

export async function ReservationsView() {
  const admin = getSupabaseAdmin();

  const { data, error } = admin
    ? await admin
        .from("reservations")
        .select(
          "id, status, start_date, confirmed_at, created_at, estured_fee_payment_id, student_profiles(first_name, last_initial), residences(name, public_area), room_types(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };
  if (error) console.error("[admin/reservations] query failed:", error);
  const reservations = (data as unknown as ReservationRow[]) ?? [];
  // DR66 (a): máximo 2 reaperturas por pago; con el tope alcanzado, «Reabrir» se deshabilita (solo Soporte).
  const expiredFeeIds = reservations.filter((r) => r.status === "expired_fee_unpaid" && r.estured_fee_payment_id).map((r) => r.estured_fee_payment_id as string);
  const cappedFeeIds = new Set<string>();
  if (admin && expiredFeeIds.length > 0) {
    const { data: fees, error: feesError } = await admin.from("estured_fee_payments").select("id, reopen_count").in("id", expiredFeeIds);
    if (feesError) console.error("[admin/reservations] reopen_count query failed:", feesError);
    for (const f of (fees ?? []) as { id: string; reopen_count: number | null }[]) if (reopenCapReached(f.reopen_count)) cappedFeeIds.add(f.id);
  }
  const activeCount = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Reservas
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {reservations.length} en total, todas las residencias. Desde acá se puede
        reabrir la ventana de pago del fee de una reserva vencida sin pagar.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <ScrollTable label="Reservas">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Alta", "Estudiante", "Residencia", "Tipo", "Ingreso", "Confirmada", "Estado", ""].map((h) => (
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
            {reservations.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.student_profiles ? `${formatShortName(r.student_profiles.first_name, r.student_profiles.last_initial)}` : "—"}
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
                    {formatDateOnly(r.start_date)}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {r.confirmed_at ? formatDate(r.confirmed_at) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === "expired_fee_unpaid" && r.estured_fee_payment_id && (
                      <ReopenFeeWindowControl feePaymentId={r.estured_fee_payment_id} limitReached={cappedFeeIds.has(r.estured_fee_payment_id)} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ScrollTable>
        {reservations.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay reservas en el sistema.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
