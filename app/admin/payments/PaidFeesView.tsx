import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { cmd } from "@/components/admin/ui/tokens";
import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import { paymentChannelLabel } from "@/lib/format/payerLabels";
import { formatArs } from "@/lib/mock/exchange";
import { loadUnconfirmedPaidFees } from "@/lib/payments/loadUnconfirmedPaidFees";
import { RetryConfirmationButton } from "@/app/admin/payments/RetryConfirmationButton";

/**
 * Histórico de fees cobrados (auditoría 2026-10-20, H25): hasta ahora
 * `/admin/payments` solo mostraba los pendientes, así que el admin no
 * podía ver qué se cobró. Solo lectura sobre `estured_fee_payments`.
 */
type PaidRow = {
  id: string;
  status: string;
  fee_amount_ars: number | string;
  payment_channel: string | null;
  paid_at: string | null;
  renewal_offer_id: string | null;
  reservations: {
    residences: { name: string } | null;
    student_profiles: { first_name: string; last_initial: string } | null;
  } | null;
  renewal_offers: {
    residences: { name: string } | null;
    student_profiles: { first_name: string; last_initial: string } | null;
  } | null;
};

const LIMIT = 100;

export async function PaidFeesView() {
  const admin = getSupabaseAdmin();
  const { data, error } = admin
    ? await admin
        .from("estured_fee_payments")
        .select(
          "id, status, fee_amount_ars, payment_channel, paid_at, renewal_offer_id, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial)), renewal_offers!estured_fee_payments_renewal_offer_fk(residences(name), student_profiles(first_name, last_initial))",
        )
        .in("status", ["paid", "refunded"])
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(LIMIT)
    : { data: [], error: null };
  if (error) console.error("[admin-payments] paid history query failed:", error);
  const rows = (data as unknown as PaidRow[]) ?? [];
  const unconfirmed = admin ? await loadUnconfirmedPaidFees(admin) : { items: [], failed: false };
  const unconfirmedIds = new Set(unconfirmed.items.map((item) => item.id));
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.fee_amount_ars), 0);

  return (
    <div className="p-8">
      <PaymentsTabs active="paid" />
      <p className="mt-3 text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {rows.length} fee(s) cobrados — {formatArs(totalPaid)} en total
        {rows.length >= LIMIT && ` (se muestran los últimos ${LIMIT})`}.
      </p>

      {unconfirmed.failed && (
        <p role="alert" className="mt-4 text-sm font-semibold" style={{ color: cmd.rose }}>
          No pudimos revisar si hay pagos registrados con la reserva sin confirmar. Recargá la pantalla.
        </p>
      )}
      {unconfirmed.items.length > 0 && (
        <AdminCard className="mt-4 p-4 md:p-6">
          <p role="alert" className="text-sm font-bold" style={{ color: cmd.rose }}>
            Pago registrado pero la reserva no se confirmó ({unconfirmed.items.length})
          </p>
          <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
            El fee figura como cobrado, pero la reserva sigue esperando el pago: el estudiante todavía no tiene su comprobante. Reintentá la
            confirmación; si vuelve a fallar, queda registrado en la auditoría.
          </p>
          <ul className="mt-3 space-y-3">
            {unconfirmed.items.map((item) => (
              <li key={item.id} className="rounded-lg p-3 text-sm" style={{ backgroundColor: cmd.roseBg }}>
                <p className="font-bold" style={{ color: cmd.onSurface }}>
                  {formatShortName(item.studentFirstName, item.studentLastInitial) || "—"} — {item.residenceName ?? "—"}
                </p>
                <p style={{ color: cmd.onSurfaceVariant }}>
                  {formatArs(item.feeAmountArs)} · cobrado el {formatDate(item.paidAt)}
                </p>
                <RetryConfirmationButton feePaymentId={item.id} />
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
              <tr>
                {["Cobrado el", "Estudiante", "Residencia", "Concepto", "Monto", "Medio", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const target = r.reservations ?? r.renewal_offers;
                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                      {formatDate(r.paid_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                      {formatShortName(target?.student_profiles?.first_name, target?.student_profiles?.last_initial) || "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                      {target?.residences?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                      {r.renewal_offer_id ? "Renovación" : "Reserva"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-bold" style={{ color: cmd.onSurface }}>
                      {formatArs(Number(r.fee_amount_ars))}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                      {paymentChannelLabel(r.payment_channel)}
                    </td>
                    <td className="px-4 py-2.5">
                      {unconfirmedIds.has(r.id) ? (
                        <AdminBadge tone="rose">Reserva sin confirmar</AdminBadge>
                      ) : (
                        <AdminBadge tone={r.status === "paid" ? "emerald" : "neutral"}>
                          {r.status === "paid" ? "Cobrado" : "Reintegrado"}
                        </AdminBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no se cobró ningún fee.
          </p>
        )}
      </AdminCard>
    </div>
  );
}

export function PaymentsTabs({ active, compact = false }: { active: "pending" | "paid" | "settings"; compact?: boolean }) {
  const tab = (key: "pending" | "paid" | "settings", label: string, href: string) => (
    <Link
      key={key}
      href={href}
      aria-current={active === key ? "page" : undefined}
      className="rounded-full px-4 py-1.5 text-sm font-bold"
      style={
        active === key
          ? { backgroundColor: cmd.primary, color: "#fff" }
          : { border: `1.5px solid ${cmd.border}`, color: cmd.onSurfaceVariant }
      }
    >
      {label}
    </Link>
  );
  return (
    <div>
      <h1 className={compact ? "text-lg font-bold" : "text-[28px] font-bold tracking-tight"} style={{ color: cmd.onSurface }}>
        Pagos fee EstuRed
      </h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {tab("pending", "Pendientes", "/admin/payments")}
        {tab("paid", "Cobrados", "/admin/payments?tab=paid")}
        {tab("settings", "Datos de cobro", "/admin/payment-settings")}
      </div>
    </div>
  );
}
