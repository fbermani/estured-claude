import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { formatUsd, formatArs, roundArs } from "@/lib/mock/exchange";
import { InitialPaymentBreakdown } from "@/components/applications/InitialPaymentBreakdown";
import { estimatedFeeUsd } from "@/lib/reservations/initialPayment";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { Icon } from "@/components/ui/Icon";
import { FeePaymentForm } from "@/app/students/applications/[id]/fee/FeePaymentForm";
import { FeeCountdown, FeeCountdownBanner } from "@/app/students/applications/[id]/fee/FeeCountdown";
import { FeeTransferInstructions } from "@/app/students/applications/[id]/fee/FeeTransferInstructions";
import { loadFeeInstructionsForPayer } from "@/lib/payments/paymentSettings";
import { formatShortName } from "@/lib/format/shortName";
import { loadActiveFamilyLink, loadActiveFamilyOfStudent, loadFamilyMember } from "@/lib/family/access";
import { formatBillingTaxId } from "@/lib/family/familyProfile";
import { FeePayerCard } from "@/app/students/applications/[id]/fee/FeePayerCard";
import { feeSupportHref, reservationReference } from "@/lib/payments/feeTransferPresentation";

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
    .select("id, status, residence_id, student_profile_id, snapshot_final_id, snapshot_original_id, residences(name)")
    .eq("id", id)
    .maybeSingle();
  if (!application) notFound();
  // Acceso: el beneficiario, o el familiar con vínculo ACTIVO (DR4); a este último solo si es el pagador designado (abajo).
  const isBeneficiary = application.student_profile_id === studentProfile?.id;
  if (!isBeneficiary) {
    const link = await loadActiveFamilyLink(admin, sessionUser.id, application.student_profile_id as string);
    // Sin el permiso de pagar el fee no ve instrucciones ni formulario (la acción también lo bloquea).
    if (!link || link.permissions.can_pay_estured_fee !== true) notFound();
  }
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
  if (!isBeneficiary && feePayment.payer_user_id !== sessionUser.id) notFound();
  const isFamilyPayer = !isBeneficiary;

  const snapshotId = application.snapshot_final_id ?? application.snapshot_original_id;
  const { data: snapshot } = await admin
    .from("application_snapshots")
    .select("monthly_price_usd, initial_duration_months, enrollment_fee_usd, deposit_usd, fee_base_usd, reservation_payment_amount_usd, reservation_payment_amount_ars")
    .eq("id", snapshotId)
    .single();
  if (!snapshot) notFound();

  const residence = application.residences as unknown as { name: string } | null;
  const { data: beneficiary } = await admin
    .from("student_profiles")
    .select("first_name, last_initial")
    .eq("id", application.student_profile_id as string)
    .maybeSingle();
  const studentName = beneficiary?.first_name ? formatShortName(beneficiary.first_name, beneficiary.last_initial) : "el estudiante";

  // DR4: datos de facturación guardados del familiar pagador (columnas de la migración 0045: si faltan, el form va vacío).
  let billingDefaults: { name: string; taxId: string; vatCondition: string } | undefined;
  if (isFamilyPayer) {
    const member = await loadFamilyMember(admin, sessionUser.id);
    const { data: billing, error: billingError } = await admin
      .from("family_members")
      .select("billing_tax_id, billing_vat_condition")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    billingDefaults = {
      name: member ? `${member.first_name} ${member.last_name}`.trim() : "",
      taxId: billingError ? "" : formatBillingTaxId(billing?.billing_tax_id as string | null),
      vatCondition: billingError ? "" : ((billing?.billing_vat_condition as string | null) ?? ""),
    };
  }

  // DR4: el beneficiario puede designar al familiar vinculado como pagador (mientras el fee espera el pago y no venció).
  const feeOpen =
    feePayment.status === "pending_payment_method" && (!feePayment.expires_at || new Date(feePayment.expires_at) > new Date());
  const designatableFamily = isBeneficiary && feeOpen ? await loadActiveFamilyOfStudent(admin, application.student_profile_id as string) : null;
  const canPickFamily = !!designatableFamily && designatableFamily.permissions.can_pay_estured_fee === true;
  // Siempre se puede volver a "pago yo" si el pagador designado no es el estudiante (aunque ya no haya familiar vinculado).
  const otherIsPayer = isBeneficiary && feePayment.payer_user_id !== sessionUser.id;
  const showPayerCard = isBeneficiary && feeOpen && (canPickFamily || otherIsPayer);
  const initialPaymentUsd = Number(snapshot.reservation_payment_amount_usd ?? 0);
  const alreadyRegistered = feePayment.status !== "pending_payment_method";
  const reference = reservationReference(reservation.id);

  // D2 / H02: los datos de cobro solo se leen si quien mira está pagando este fee.
  const instructionsResult = alreadyRegistered
    ? null
    : await loadFeeInstructionsForPayer(admin, { userId: sessionUser.id, feePaymentId: feePayment.id });
  const payerMismatch = instructionsResult?.status === "forbidden";
  const supportHref = feeSupportHref(reservation.id);

  const payBlock = (
    <>
      {instructionsResult?.status === "ready" && (
        <FeeTransferInstructions
          amountArs={Number(feePayment.fee_amount_ars)}
          reference={reference}
          instructions={instructionsResult.instructions}
        />
      )}
      {instructionsResult?.status === "not_configured" && (
        <p role="status" className="mt-6 rounded-field bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
          Estamos preparando los datos de pago. Escribile a EstuRed desde{" "}
          <Link href={supportHref} className="underline">
            Soporte
          </Link>{" "}
          y te los pasamos; tu referencia es <span className="font-mono font-bold">{reference}</span>.
        </p>
      )}
      <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-xs text-ink-faint">
        El cobro automático (MercadoPago / PayU Argentina) todavía no está activado: por ahora el fee se paga por
        transferencia y lo validamos a mano.
      </p>
    </>
  );

  const supportLink = (
    <Link
      href={supportHref}
      className="mt-4 inline-flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
    >
      <Icon name="support_agent" className="text-base text-forest-700" /> Tengo un problema con el pago
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Fee EstuRed — {residence?.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {isFamilyPayer
          ? `Estás designado/a para pagar este fee de la reserva de ${studentName}: es el 5% de la estadía inicial reservada y va aparte del pago que se hizo directamente a la residencia.`
          : "El fee EstuRed es el 5% de tu estadía inicial reservada. Va aparte del pago que le hiciste directamente a la residencia."}
      </p>

      {/* El plazo va primero: antes de "¿Quién paga?" y del desglose (también en mobile). */}
      {!alreadyRegistered && !payerMismatch && feePayment.expires_at && (
        <FeeCountdownBanner expiresAt={feePayment.expires_at} nowIso={new Date().toISOString()} supportHref={supportHref} />
      )}

      <Card className="mt-6 p-6">
        {/* D7/H08: mismo desglose que en la solicitud — pago inicial a la residencia (ya informado) y fee a EstuRed. */}
        {initialPaymentUsd > 0 && (
          <InitialPaymentBreakdown
            className="mb-5"
            residenceUsd={initialPaymentUsd}
            residenceArs={snapshot.reservation_payment_amount_ars != null ? roundArs(Number(snapshot.reservation_payment_amount_ars)) : null}
            residencePaid
            feeUsd={snapshot.fee_base_usd != null ? estimatedFeeUsd(Number(snapshot.fee_base_usd)) : null}
            feeArs={Number(feePayment.fee_amount_ars)}
          />
        )}
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
            <dd className="font-bold text-forest-700">
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

      {showPayerCard && (
        <FeePayerCard
          applicationId={id}
          familyName={designatableFamily?.name ?? null}
          otherIsPayer={otherIsPayer}
          payerIsLinkedFamily={!!designatableFamily && feePayment.payer_user_id === designatableFamily.userId}
        />
      )}

      {payerMismatch ? (
        <p role="status" className="mt-6 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
          El pago lo hace quien está designado como pagador de esta reserva. Si necesitás ayuda con el pago,{" "}
          <Link href={supportHref} className="font-semibold text-forest-700 underline">
            escribile a EstuRed desde Soporte
          </Link>
          .
        </p>
      ) : feePayment.status === "paid" ? (
        <p className="mt-6 rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
          {isFamilyPayer ? `Fee pagado. La reserva de ${studentName} está confirmada.` : "Fee pagado. Tu reserva está confirmada."}
        </p>
      ) : alreadyRegistered ? (
        <>
          <p className="mt-6 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            Ya hay un comprobante registrado para este pago — está esperando validación de EstuRed. Te avisamos cuando
            se confirme.
          </p>
          {supportLink}
        </>
      ) : feePayment.expires_at ? (
        // El plazo manda: vencido, no se muestran datos de transferencia ni el formulario (ni siquiera sin recargar).
        <FeeCountdown expiresAt={feePayment.expires_at} nowIso={new Date().toISOString()} supportHref={supportHref}>
          {payBlock}
          {supportLink}
          <FeePaymentForm applicationId={id} defaults={billingDefaults} />
        </FeeCountdown>
      ) : (
        <>
          {payBlock}
          {supportLink}
          <FeePaymentForm applicationId={id} defaults={billingDefaults} />
        </>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        El fee EstuRed no se reembolsa automáticamente ante cancelación — EstuRed revisa cada caso.
      </p>
    </div>
  );
}
