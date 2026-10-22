import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import { formatArs } from "@/lib/mock/exchange";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { PaymentDetail } from "@/app/admin/payments/PaymentDetail";
import { RenewalPaymentDetail } from "@/app/admin/payments/RenewalPaymentDetail";
import { PaidFeesView, PaymentsTabs } from "@/app/admin/payments/PaidFeesView";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Pagos fee EstuRed" };
export const dynamic = "force-dynamic";

const PENDING_STATUSES = ["pending_payment_method", "pending_manual_payment"];

const statusBadge: Record<string, { label: string; tone: "amber" | "violet" | "rose" }> = {
  pending_payment_method: { label: "Sin comprobante", tone: "amber" },
  pending_manual_payment: { label: "Esperando validación", tone: "violet" },
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>;
}) {
  await requireAdmin();
  const { id: selectedId, tab } = await searchParams;
  if (tab === "paid") return <PaidFeesView />;
  const admin = getSupabaseAdmin();

  // Embebe ambos lados (reservations y renewal_offers) — un
  // estured_fee_payments es de uno u otro, nunca ambos (constraint
  // estured_fee_payments_target_check, migración 0010). Hint de FK
  // explícito en los dos: trampa bidireccional documentada en
  // MEMORY.md §10/§17/§18/§22/§23.
  const queueResult = admin
    ? await admin
        .from("estured_fee_payments")
        .select(
          "id, status, fee_amount_ars, payment_channel, created_at, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial)), renewal_offers!estured_fee_payments_renewal_offer_fk(residences(name), student_profiles(first_name, last_initial))",
        )
        .in("status", PENDING_STATUSES)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (queueResult.error) console.error("[admin-payments] queue query failed:", queueResult.error);
  const queue = queueResult.data ?? [];

  const paymentSettingsMissing = admin ? (await loadPaymentSettings(admin)) === null : false;

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail: Parameters<typeof PaymentDetail>[0] | null = null;
  let renewalDetail: Parameters<typeof RenewalPaymentDetail>[0] | null = null;
  if (admin && activeId) {
    const { data: feePayment, error: feePaymentError } = await admin
      .from("estured_fee_payments")
      .select(
        "id, status, fee_amount_ars, fee_base_usd, fee_base_ars, payment_channel, payer_billing_name, payer_billing_cuit, payer_iva_condition, manual_payment_file_id, reservation_id, renewal_offer_id, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial), start_date, initial_duration_months), renewal_offers!estured_fee_payments_renewal_offer_fk(residences(name), student_profiles(first_name, last_initial), period_start_date, period_end_date, duration_months)",
      )
      .eq("id", activeId)
      .maybeSingle();
    if (feePaymentError) console.error("[admin-payments] detail query failed:", feePaymentError);

    if (feePayment) {
      // El signed URL ya NO se genera acá (docs/09 §18.2: requiere
      // justificación auditada antes de verse) — solo pasamos el id
      // del archivo, `DocumentAccessButton` pide el motivo y genera el
      // link recién ahí.
      const proofFileId = feePayment.manual_payment_file_id ?? null;
      if (feePayment.renewal_offer_id) {
        const renewalOfferDetail = feePayment.renewal_offers as unknown as {
          residences: { name: string } | null;
          student_profiles: { first_name: string; last_initial: string } | null;
          period_start_date: string;
          period_end_date: string;
          duration_months: number;
        } | null;
        renewalDetail = { feePayment: { ...feePayment, renewal_offers: renewalOfferDetail }, proofFileId };
      } else {
        const reservationDetail = feePayment.reservations as unknown as {
          residences: { name: string } | null;
          student_profiles: { first_name: string; last_initial: string } | null;
          start_date: string;
          initial_duration_months: number;
        } | null;
        detail = { feePayment: { ...feePayment, reservations: reservationDetail }, proofFileId };
      }
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <PaymentsTabs active="pending" compact />
          <p className="mt-2 text-xs" style={{ color: cmd.outline }}>
            {queue.length} pendientes de validación
          </p>
        </div>
        {queue.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            No hay pagos pendientes.
          </p>
        ) : (
          <ul>
            {queue.map((p) => {
              const reservation = p.reservations as unknown as {
                residences: { name: string } | null;
                student_profiles: { first_name: string; last_initial: string } | null;
              } | null;
              const renewalOffer = p.renewal_offers as unknown as {
                residences: { name: string } | null;
                student_profiles: { first_name: string; last_initial: string } | null;
              } | null;
              const target = reservation ?? renewalOffer;
              const badge = statusBadge[p.status] ?? statusBadge.pending_payment_method;
              const active = p.id === activeId;
              return (
                <li key={p.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/payments?id=${p.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                        {renewalOffer && <AdminBadge tone="violet">Renovación</AdminBadge>}
                      </div>
                      <span className="text-xs font-bold" style={{ color: cmd.onSurface }}>
                        {formatArs(Number(p.fee_amount_ars))}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {formatShortName(target?.student_profiles?.first_name, target?.student_profiles?.last_initial)}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {target?.residences?.name}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {paymentSettingsMissing && (
          <AdminCard className="mb-6 max-w-2xl p-4">
            <p role="status" className="text-sm font-semibold" style={{ color: cmd.amber }}>
              Faltan los datos de cobro del fee.
            </p>
            <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
              Sin ellos, los estudiantes no ven a qué cuenta transferir.{" "}
              <Link href="/admin/payment-settings" className="font-bold underline">
                Cargarlos ahora
              </Link>
            </p>
          </AdminCard>
        )}
        {detail ? (
          <PaymentDetail {...detail} />
        ) : renewalDetail ? (
          <RenewalPaymentDetail {...renewalDetail} />
        ) : (
          <AdminCard className="p-8 text-center">
            <p className="text-sm" style={{ color: cmd.outline }}>
              Seleccioná un pago de la lista para revisarlo.
            </p>
          </AdminCard>
        )}
      </div>
    </div>
  );
}
