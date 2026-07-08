import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { formatUsd } from "@/lib/mock/exchange";
import { calculateFeeEstimate } from "@/lib/applications/fee";
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
    .select("id, status, student_profile_id, snapshot_original_id, residences(name)")
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
        "monthly_price_usd, enrollment_fee_usd, deposit_usd, initial_duration_months, reservation_payment_amount_usd",
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
  });

  const residence = application.residences as unknown as { name: string } | null;

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
      proposal.proposed_start_date ? new Date(proposal.proposed_start_date).toLocaleDateString("es-AR") : null,
    ),
    row(
      "Monto para reservar",
      formatUsd(original.reservation_payment_amount_usd),
      proposal.proposed_reservation_payment_amount_usd
        ? formatUsd(proposal.proposed_reservation_payment_amount_usd)
        : null,
    ),
    row("Fee EstuRed estimado", "—", `≈ ${fee.estimatedFeeArs.toLocaleString("es-AR")} ARS (recalculado)`),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">{residence?.name} te propuso un ajuste</h1>
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
        <table className="w-full text-sm">
          <thead className="bg-sand-100 text-left text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Condición</th>
              <th className="px-4 py-3 font-medium">Original</th>
              <th className="px-4 py-3 font-medium">Propuesta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-3 text-ink-soft">{r.label}</td>
                <td className="px-4 py-3 text-ink">{r.original}</td>
                <td className="px-4 py-3 font-medium text-petrol-700">{r.proposed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <NegotiationResponse applicationId={id} />
    </div>
  );
}
