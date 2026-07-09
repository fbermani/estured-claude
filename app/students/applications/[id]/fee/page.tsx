import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { formatUsd, formatArs } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { FeePaymentForm } from "@/app/students/applications/[id]/fee/FeePaymentForm";

export const metadata: Metadata = { title: "Pago fee EstuRed" };
export const dynamic = "force-dynamic";

const FEE_STATUS_LABEL: Record<string, string> = {
  pending_payment_method: "Pendiente de elegir medio de pago",
  pending_manual_payment: "Comprobante enviado — esperando validación de EstuRed",
  pending_auto_charge: "Procesando",
  processing: "Procesando",
  paid: "Pagado",
  failed: "Falló",
  expired: "Vencido",
  refunded: "Reembolsado",
  chargeback: "Contracargo",
};

export default async function FeePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, student_profile_id, snapshot_final_id, snapshot_original_id, residences(name)")
    .eq("id", id)
    .maybeSingle();
  if (!application || application.student_profile_id !== studentProfile?.id) notFound();
  if (application.status !== "converted_to_reservation") {
    redirect(`/students/applications/${id}`);
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, estured_fee_payment_id, booking_receipt_id")
    .eq("application_request_id", id)
    .single();
  if (!reservation) notFound();

  if (reservation.status !== "pending_estured_fee") {
    redirect(reservation.booking_receipt_id ? `/students/receipts/${reservation.booking_receipt_id}` : `/students/applications/${id}`);
  }

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("*")
    .eq("id", reservation.estured_fee_payment_id)
    .single();
  if (!feePayment) notFound();

  const snapshotId = application.snapshot_final_id ?? application.snapshot_original_id;
  const { data: snapshot } = await admin
    .from("application_snapshots")
    .select("monthly_price_usd, initial_duration_months, enrollment_fee_usd, deposit_usd")
    .eq("id", snapshotId)
    .single();
  if (!snapshot) notFound();

  const residence = application.residences as unknown as { name: string } | null;
  const alreadyRegistered = feePayment.status !== "pending_payment_method";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">Fee EstuRed — {residence?.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        El fee EstuRed es el 5% de tu estadía inicial reservada. Va aparte del pago que le hiciste
        directamente a la residencia.
      </p>

      <Card className="mt-6 p-6">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Tarifa mensual acordada</dt>
            <dd className="font-medium text-ink">{formatUsd(Number(snapshot.monthly_price_usd))}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Duración inicial</dt>
            <dd className="font-medium text-ink">{snapshot.initial_duration_months} meses</dd>
          </div>
          {snapshot.enrollment_fee_usd && (
            <div className="flex justify-between border-b border-sand-200 pb-2">
              <dt className="text-ink-faint">Matrícula (incluida en la base)</dt>
              <dd className="font-medium text-ink">{formatUsd(Number(snapshot.enrollment_fee_usd))}</dd>
            </div>
          )}
          {snapshot.deposit_usd && (
            <div className="flex justify-between border-b border-sand-200 pb-2">
              <dt className="text-ink-faint">Depósito (excluido del fee)</dt>
              <dd className="font-medium text-ink">{formatUsd(Number(snapshot.deposit_usd))}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fee EstuRed (5%)</dt>
            <dd className="font-bold text-petrol-700">
              {formatArs(Number(feePayment.fee_amount_ars))}
              <ExchangeRateNote />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-faint">Estado</dt>
            <dd className="font-medium text-ink">{FEE_STATUS_LABEL[feePayment.status] ?? feePayment.status}</dd>
          </div>
        </dl>
      </Card>

      <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-xs text-ink-faint">
        El cobro automático (MercadoPago / PayU Argentina) todavía no está activado. Mientras tanto,
        coordiná el pago por transferencia con soporte y subí el comprobante acá — nuestro equipo lo
        valida y confirma tu reserva.
      </p>

      {feePayment.status === "paid" ? (
        <p className="mt-6 rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
          Fee pagado. Tu reserva está confirmada.
        </p>
      ) : alreadyRegistered ? (
        <p className="mt-6 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
          Ya registraste un comprobante para este pago — está esperando validación de EstuRed. Te
          avisamos cuando se confirme.
        </p>
      ) : (
        <FeePaymentForm applicationId={id} />
      )}

      <p className="mt-4 text-xs text-ink-faint">
        El fee EstuRed no se reembolsa automáticamente ante cancelación — EstuRed revisa cada caso.
      </p>
    </div>
  );
}
