import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatUsd } from "@/lib/mock/exchange";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { normalizeInitialPaymentMode, resolveNegotiatedInitialPaymentUsd } from "@/lib/reservations/initialPayment";
import { NegotiationResponse } from "@/app/students/applications/[id]/negotiation/NegotiationResponse";

export const metadata: Metadata = { title: "Propuesta de ajuste recibida" };
export const dynamic = "force-dynamic";

function row(label: string, original: string, proposed: string | null) {
  return { label, original, proposed: proposed ?? "Sin cambios" };
}

export default async function NegotiationResponsePage({
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
    .select("id, status, student_profile_id, snapshot_original_id, residence_id, residences(name)")
    .eq("id", id)
    .maybeSingle();
  if (!application || application.student_profile_id !== studentProfile?.id) notFound();
  if (application.status !== "offer_pending_student_acceptance") {
    redirect(`/students/applications/${id}`);
  }

  const [{ data: original }, { data: proposal }] = await Promise.all([
    admin
      .from("application_snapshots")
      .select(
        "*",
      )
      .eq("id", application.snapshot_original_id)
      .single(),
    admin
      .from("application_negotiation_proposals")
      .select("*")
      .eq("application_request_id", id)
      .single(),
  ]);

  if (!proposal || !original) notFound();

  const finalMonthlyPrice = proposal.proposed_monthly_price_usd ?? original.monthly_price_usd;
  const finalDuration = proposal.proposed_duration_months ?? original.initial_duration_months;
  const finalEnrollmentFee = proposal.proposed_enrollment_fee_usd ?? original.enrollment_fee_usd;
  const fee = calculateFeeEstimate({
    monthlyPriceUsd: Number(finalMonthlyPrice),
    durationMonths: Number(finalDuration),
    enrollmentFeeUsd: finalEnrollmentFee ? Number(finalEnrollmentFee) : null,
    emptyMonthsChargeUsd: original.empty_months_charge_usd ? Number(original.empty_months_charge_usd) : null,
    arsPerUsd: Number(original.exchange_rate_ars_per_usd),
  });

  const residence = application.residences as unknown as { name: string } | null;

  // D7/H08: mismo cálculo que el snapshot final al aceptar (el pago inicial puede seguir la tarifa negociada).
  const { data: residenceRow } = await admin.from("residences").select("*").eq("id", application.residence_id).maybeSingle();
  const finalInitialPaymentUsd = resolveNegotiatedInitialPaymentUsd({
    proposedUsd:
      proposal.proposed_reservation_payment_amount_usd != null
        ? Number(proposal.proposed_reservation_payment_amount_usd)
        : null,
    originalInitialUsd: Number(original.reservation_payment_amount_usd ?? original.monthly_price_usd),
    originalMonthlyUsd: Number(original.monthly_price_usd),
    finalMonthlyUsd: Number(finalMonthlyPrice),
    mode: normalizeInitialPaymentMode(residenceRow?.reservation_initial_payment_mode),
    originalEnrollmentUsd: Number(original.enrollment_fee_usd ?? 0),
    finalEnrollmentUsd: Number(finalEnrollmentFee ?? 0),
    originalDepositUsd: Number(original.deposit_usd ?? 0),
    finalDepositUsd: Number(proposal.proposed_deposit_usd ?? original.deposit_usd ?? 0),
  });

  const rows = [
    row(
      "Tarifa mensual",
      formatUsd(original.monthly_price_usd),
      proposal.proposed_monthly_price_usd ? formatUsd(proposal.proposed_monthly_price_usd) : null,
    ),
    row(
      "Matrícula",
      original.enrollment_fee_usd ? formatUsd(original.enrollment_fee_usd) : "—",
      proposal.proposed_enrollment_fee_usd ? formatUsd(proposal.proposed_enrollment_fee_usd) : null,
    ),
    row(
      "Depósito",
      original.deposit_usd ? formatUsd(original.deposit_usd) : "—",
      proposal.proposed_deposit_usd ? formatUsd(proposal.proposed_deposit_usd) : null,
    ),
    row(
      "Duración",
      `${original.initial_duration_months} meses`,
      proposal.proposed_duration_months ? `${proposal.proposed_duration_months} meses` : null,
    ),
    row(
      "Fecha de ingreso",
      "Original de tu solicitud",
      proposal.proposed_start_date ? formatDateOnly(proposal.proposed_start_date) : null,
    ),
    row(
      "Pago inicial para reservar",
      formatUsd(original.reservation_payment_amount_usd),
      finalInitialPaymentUsd !== Number(original.reservation_payment_amount_usd)
        ? formatUsd(finalInitialPaymentUsd)
        : null,
    ),
    row("Fee EstuRed estimado", "—", `≈ ${fee.estimatedFeeArs.toLocaleString("es-AR")} ARS (recalculado)`),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">{residence?.name} te propuso un ajuste</h1>
      <p className="mt-2 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
        Esta es la única propuesta de ajuste que la residencia puede enviarte para esta solicitud.
        Solo podés aceptarla o rechazarla — no podés editarla.
      </p>

      {proposal.special_conditions && (
        <p className="mt-4 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Condiciones especiales:</span>{" "}
          {proposal.special_conditions}
        </p>
      )}

      <Card className="mt-6 overflow-hidden p-0">
        <table role="table" className="block w-full text-sm sm:table">
          <thead role="rowgroup" className="sr-only bg-sand-100 text-left text-ink-soft sm:not-sr-only sm:table-header-group">
            <tr role="row">
              <th role="columnheader" className="px-4 py-3 font-medium">Condición</th>
              <th role="columnheader" className="px-4 py-3 font-medium">Original</th>
              <th role="columnheader" className="px-4 py-3 font-medium">Propuesta</th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block divide-y divide-sand-200 sm:table-row-group">
            {rows.map((r) => (
              <tr role="row" key={r.label} className="grid gap-0.5 px-4 py-3 sm:table-row sm:p-0">
                <td role="cell" className="font-semibold text-ink sm:px-4 sm:py-3 sm:font-normal sm:text-ink-soft">{r.label}</td>
                <td role="cell" className="text-ink sm:px-4 sm:py-3"><span aria-hidden="true" className="text-ink-faint sm:hidden">Original: </span>{r.original}</td>
                <td role="cell" className="font-medium text-forest-700 sm:px-4 sm:py-3"><span aria-hidden="true" className="font-normal text-ink-faint sm:hidden">Propuesta: </span>{r.proposed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-ink-faint">
        El fee EstuRed estimado en ARS es referencial.
        <ExchangeRateNote />
      </p>

      <NegotiationResponse applicationId={id} />
    </div>
  );
}
