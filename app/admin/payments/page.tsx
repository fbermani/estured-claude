import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadPaymentSettings } from "@/lib/payments/paymentSettings";
import { formatArs } from "@/lib/mock/exchange";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { PaymentDetail, type FeePayer } from "@/app/admin/payments/PaymentDetail";
import { describeFeeCountdown } from "@/lib/payments/feeTransferPresentation";
import { RenewalPaymentDetail } from "@/app/admin/payments/RenewalPaymentDetail";
import { PaidFeesView, PaymentsTabs } from "@/app/admin/payments/PaidFeesView";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { loadUnconfirmedPaidFees } from "@/lib/payments/loadUnconfirmedPaidFees";

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
  const adminUser = await requireAdmin();
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

  // Fees `paid` con la reserva sin confirmar (DR8): se resuelven desde "Cobrados"; acá solo el aviso para que no pasen desapercibidos.
  const unconfirmedPaid = admin ? await loadUnconfirmedPaidFees(admin) : { items: [], failed: false };

  const paymentSettingsMissing = admin ? (await loadPaymentSettings(admin)) === null : false;

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail: Parameters<typeof PaymentDetail>[0] | null = null;
  let renewalDetail: Parameters<typeof RenewalPaymentDetail>[0] | null = null;
  if (admin && activeId) {
    const { data: feePayment, error: feePaymentError } = await admin
      .from("estured_fee_payments")
      .select(
        "id, status, fee_amount_ars, fee_amount_usd, fee_rate_percent, fee_base_usd, fee_base_ars, expires_at, payer_user_id, payment_channel, payer_billing_name, payer_billing_cuit, payer_iva_condition, manual_payment_file_id, reservation_id, renewal_offer_id, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial, user_id), start_date, initial_duration_months), renewal_offers!estured_fee_payments_renewal_offer_fk(residences(name), student_profiles(first_name, last_initial), period_start_date, period_end_date, duration_months)",
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
          student_profiles: { first_name: string; last_initial: string; user_id: string } | null;
          start_date: string;
          initial_duration_months: number;
        } | null;
        // Pagador (DR8): el estudiante o su familiar vinculado. Solo nombre corto y rol, sin datos de contacto ni de facturación.
        let payer: FeePayer = { name: null, role: "unknown" };
        const payerUserId = (feePayment.payer_user_id as string | null) ?? null;
        const student = reservationDetail?.student_profiles ?? null;
        if (payerUserId && student && payerUserId === student.user_id) {
          payer = { name: formatShortName(student.first_name, student.last_initial), role: "student" };
        } else if (payerUserId) {
          const { data: familyMember, error: familyMemberError } = await admin
            .from("family_members")
            .select("first_name, last_name")
            .eq("user_id", payerUserId)
            .maybeSingle();
          if (familyMemberError) console.error("[admin-payments] payer family member query failed:", familyMemberError);
          payer = {
            name: familyMember ? formatShortName(familyMember.first_name as string, familyMember.last_name as string) || null : null,
            role: "family",
          };
        }
        detail = {
          feePayment: { ...feePayment, reservations: reservationDetail },
          proofFileId,
          payer,
          isSuperadmin: adminUser.roles.includes("superadmin"),
          // Se calcula acá (servidor) y no en el cliente para que el texto relativo no desincronice la hidratación.
          countdown: describeFeeCountdown((feePayment.expires_at as string | null) ?? null),
        };
      }
    }
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="w-full shrink-0 border-b md:w-96 md:overflow-y-auto md:border-b-0 md:border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <PaymentsTabs active="pending" compact />
          <p className="mt-2 text-xs" style={{ color: cmd.outline }}>
            {queue.length} pendientes de validación
          </p>
          {(unconfirmedPaid.items.length > 0 || unconfirmedPaid.failed) && (
            <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: cmd.rose }}>
              {unconfirmedPaid.failed
                ? "No pudimos revisar los pagos con la reserva sin confirmar. "
                : `${unconfirmedPaid.items.length} pago(s) registrado(s) con la reserva sin confirmar. `}
              <Link href="/admin/payments?tab=paid" className="underline">
                Ver en Cobrados
              </Link>
            </p>
          )}
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

      <div className="min-w-0 flex-1 p-4 md:overflow-y-auto md:p-8">
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
