import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { PaymentDetail } from "@/app/admin/payments/PaymentDetail";

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
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const queueResult = admin
    ? await admin
        .from("estured_fee_payments")
        .select(
          "id, status, fee_amount_ars, payment_channel, created_at, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial))",
        )
        .in("status", PENDING_STATUSES)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (queueResult.error) console.error("[admin-payments] queue query failed:", queueResult.error);
  const queue = queueResult.data ?? [];

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail = null;
  if (admin && activeId) {
    const { data: feePayment, error: feePaymentError } = await admin
      .from("estured_fee_payments")
      .select(
        "id, status, fee_amount_ars, fee_base_usd, fee_base_ars, payment_channel, payer_billing_name, payer_billing_cuit, payer_iva_condition, manual_payment_file_id, reservations!estured_fee_payments_reservation_id_fkey(residences(name), student_profiles(first_name, last_initial), start_date, initial_duration_months)",
      )
      .eq("id", activeId)
      .maybeSingle();
    if (feePaymentError) console.error("[admin-payments] detail query failed:", feePaymentError);

    if (feePayment) {
      let proofUrl: string | null = null;
      if (feePayment.manual_payment_file_id) {
        const { data: file } = await admin
          .from("files")
          .select("bucket, storage_path")
          .eq("id", feePayment.manual_payment_file_id)
          .maybeSingle();
        if (file) {
          proofUrl =
            (await admin.storage.from(file.bucket).createSignedUrl(file.storage_path, 3600)).data?.signedUrl ?? null;
        }
      }
      const reservationDetail = feePayment.reservations as unknown as {
        residences: { name: string } | null;
        student_profiles: { first_name: string; last_initial: string } | null;
        start_date: string;
        initial_duration_months: number;
      } | null;
      detail = { feePayment: { ...feePayment, reservations: reservationDetail }, proofUrl };
    }
  }

  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Pagos fee EstuRed
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
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
              const badge = statusBadge[p.status] ?? statusBadge.pending_payment_method;
              const active = p.id === activeId;
              return (
                <li key={p.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/payments?id=${p.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                      <span className="text-xs font-bold" style={{ color: cmd.onSurface }}>
                        ARS {Number(p.fee_amount_ars).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {reservation?.student_profiles?.first_name} {reservation?.student_profiles?.last_initial}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {reservation?.residences?.name}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {detail ? (
          <PaymentDetail {...detail} />
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
