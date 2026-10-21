import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PaymentProofUpload } from "@/app/students/applications/[id]/payment/PaymentProofUpload";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication } from "@/lib/applications/loadReservationInfo";
import { loadAgreedConditionsByApplication } from "@/lib/applications/loadApplicationSnapshots";
import { buildApplicationTimeline } from "@/lib/applications/timeline";
import { ApplicationTimeline } from "@/components/applications/ApplicationTimeline";
import { AgreedConditionsCard } from "@/components/applications/AgreedConditionsCard";

/** Estados en los que las condiciones ya fueron aceptadas (docs/04 §5.2). */
const CONDITIONS_AGREED_STATUSES = new Set([
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
  "converted_to_reservation",
]);

export const metadata: Metadata = { title: "Detalle de solicitud" };
export const dynamic = "force-dynamic";

export default async function StudentApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  if (!supabase) notFound();

  const { data: application } = await supabase
    .from("application_requests")
    .select(
      "id, status, desired_start_date, initial_duration_months, academic_objective, rejection_reason_code, created_at, contact_established_at, snapshot_original_id, snapshot_final_id, residences(name, public_area, responsible_contact), room_types(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!application) notFound();

  const residence = application.residences as unknown as { name: string; public_area: string } | null;
  const roomType = application.room_types as unknown as { name: string } | null;

  // H01: estado visible = solicitud + reserva asociada (la reserva manda).
  const reservation =
    application.status === "converted_to_reservation"
      ? ((await loadReservationInfoByApplication(supabase, [id])).get(id) ?? null)
      : null;
  const info = getVisibleStatus({ applicationStatus: application.status, reservation, viewer: "student" });

  // H07: montos y recorrido salen del snapshot y de los hitos reales, nunca del precio vigente de `room_types`.
  const [conditionsByApp, { data: residencePayment }, { data: reservationRow }] = await Promise.all([
    loadAgreedConditionsByApplication(supabase, [
      {
        id,
        snapshot_original_id: application.snapshot_original_id as string | null,
        snapshot_final_id: application.snapshot_final_id as string | null,
      },
    ]),
    supabase
      .from("external_residence_payments")
      .select("reported_received_at, amount_reported_usd, amount_reported_ars")
      .eq("application_request_id", id)
      .maybeSingle(),
    reservation
      ? supabase
          .from("reservations")
          .select("confirmed_at, estured_fee_payment_id")
          .eq("application_request_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const conditions = conditionsByApp.get(id) ?? null;
  const { data: feePayment } = reservationRow?.estured_fee_payment_id
    ? await supabase
        .from("estured_fee_payments")
        .select("status, fee_amount_ars, paid_at")
        .eq("id", reservationRow.estured_fee_payment_id as string)
        .maybeSingle()
    : { data: null };

  const timeline = buildApplicationTimeline({
    applicationStatus: application.status,
    createdAt: application.created_at,
    contactEstablishedAt: application.contact_established_at as string | null,
    residencePaymentReportedAt: (residencePayment?.reported_received_at as string | null) ?? null,
    feePaidAt: (feePayment?.paid_at as string | null) ?? null,
    reservationConfirmedAt: (reservationRow?.confirmed_at as string | null) ?? null,
    reservationStatus: reservation?.status ?? null,
    isClosed: info.isClosed,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">{residence?.name}</h1>
            <p className="text-sm text-ink-soft">
              {roomType?.name} · {residence?.public_area}, CABA
            </p>
          </div>
          <Badge tone={info.tone}>{info.label}</Badge>
        </div>

        {info.helper && (
          <div className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Qué sigue</p>
            <p className="mt-1">{info.helper}</p>
          </div>
        )}

        {info.nextAction === "respond_offer" && (
          <Button href={`/students/applications/${id}/negotiation`} size="lg" className="mt-4 w-full">
            Ver propuesta de ajuste
          </Button>
        )}
        {info.nextAction === "pay_fee" && (
          <Button href={`/students/applications/${id}/fee`} size="lg" className="mt-4 w-full">
            Pagar fee EstuRed
          </Button>
        )}
        {info.nextAction === "view_fee_status" && reservation?.status === "pending_estured_fee" && (
          <Button href={`/students/applications/${id}/fee`} size="lg" variant="outline" className="mt-4 w-full">
            Ver estado del fee
          </Button>
        )}
        {info.nextAction === "view_receipt" && reservation?.bookingReceiptId && (
          <Button href={`/students/receipts/${reservation.bookingReceiptId}`} size="lg" className="mt-4 w-full">
            Ver comprobante de reserva
          </Button>
        )}
        {info.nextAction === "contact_support" && (
          <Button href="/students/support" size="lg" variant="outline" className="mt-4 w-full">
            Escribir a Soporte
          </Button>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Fecha de ingreso deseada</dt>
            <dd className="font-medium text-ink">{application.desired_start_date}</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Duración estimada</dt>
            <dd className="font-medium text-ink">{application.initial_duration_months} meses</dd>
          </div>
          <div className="flex justify-between border-b border-sand-200 pb-2">
            <dt className="text-ink-faint">Enviada</dt>
            <dd className="font-medium text-ink">
              {new Date(application.created_at).toLocaleDateString("es-AR")}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Tu objetivo académico:</span>{" "}
          {application.academic_objective}
        </p>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">Cómo viene la solicitud</h2>
        <div className="mt-4">
          <ApplicationTimeline steps={timeline} />
        </div>
      </Card>

      {conditions ? (
        <AgreedConditionsCard
          conditions={conditions}
          agreed={CONDITIONS_AGREED_STATUSES.has(application.status)}
          feeRealArs={feePayment ? Number(feePayment.fee_amount_ars) : null}
          feeIsPaid={feePayment?.status === "paid"}
          residencePaymentReported={
            residencePayment && (residencePayment.amount_reported_usd !== null || residencePayment.amount_reported_ars !== null)
              ? {
                  usd: residencePayment.amount_reported_usd !== null ? Number(residencePayment.amount_reported_usd) : null,
                  ars: residencePayment.amount_reported_ars !== null ? Number(residencePayment.amount_reported_ars) : null,
                }
              : null
          }
        />
      ) : (
        <Card className="mt-6 p-6 text-sm text-ink-soft">
          No pudimos cargar las condiciones de esta solicitud. Probá de nuevo en unos minutos o escribile a Soporte.
        </Card>
      )}

      {/* H01: el comprobante de pago a la residencia es del paso anterior — una vez
          que existe la reserva ya no tiene sentido ofrecerlo. */}
      {application.status === "residence_payment_pending" && <PaymentProofUpload applicationId={id} />}
    </div>
  );
}
