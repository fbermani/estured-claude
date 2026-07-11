import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd, formatArs } from "@/lib/mock/exchange";
import { CreateOfferForm } from "@/app/residence/[residence_id]/renewals/[id]/CreateOfferForm";
import { SendOfferButton } from "@/app/residence/[residence_id]/renewals/[id]/SendOfferButton";
import { MarkResidencePaymentReceivedForm } from "@/app/residence/[residence_id]/renewals/[id]/MarkResidencePaymentReceivedForm";
import { RESIDENCE_OFFER_STATUS_COPY } from "@/lib/renewals/statusCopy";

export const metadata: Metadata = { title: "Detalle de renovación" };
export const dynamic = "force-dynamic";

const ACTIVE_OFFER_STATUSES = new Set(["draft", "sent", "viewed"]);

export default async function ResidenceRenewalDetailPage({
  params,
}: {
  params: Promise<{ residence_id: string; id: string }>;
}) {
  const { residence_id: residenceId, id: reservationId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: reservation } = await admin
    .from("reservations")
    .select(
      "id, status, start_date, initial_duration_months, snapshot_id, residence_id, student_profiles (first_name, last_initial), room_types (name)",
    )
    .eq("id", reservationId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  if (!reservation) notFound();

  const { data: snapshot } = await admin
    .from("application_snapshots")
    .select("monthly_price_usd")
    .eq("id", reservation.snapshot_id)
    .single();

  const { data: request, error: requestError } = await admin
    .from("renewal_requests")
    .select("id, message, desired_duration_months, status, created_at")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (requestError) console.error("[residence/renewals] renewal_requests query failed:", requestError);

  const { data: offers, error: offersError } = await admin
    .from("renewal_offers")
    .select(
      "id, status, period_start_date, period_end_date, duration_months, monthly_price_usd, monthly_price_ars, enrollment_or_renewal_fee_usd, estimated_estured_fee_ars, acceptance_deadline_at, created_at",
    )
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false });
  if (offersError) console.error("[residence/renewals] renewal_offers query failed:", offersError);

  const student = reservation.student_profiles as unknown as { first_name: string; last_initial: string } | null;
  const roomType = reservation.room_types as unknown as { name: string } | null;
  const latestOffer = offers?.[0] ?? null;
  const canCreateOffer = !latestOffer || !ACTIVE_OFFER_STATUSES.has(latestOffer.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">
        Renovación — {student?.first_name} {student?.last_initial}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {roomType?.name} · Ingreso original {reservation.start_date} · {reservation.initial_duration_months} meses
      </p>

      {request && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-semibold text-ink">Solicitud del estudiante</p>
          {request.desired_duration_months && (
            <p className="mt-1 text-sm text-ink-soft">Duración deseada: {request.desired_duration_months} meses</p>
          )}
          {request.message && <p className="mt-1 text-sm text-ink-soft">&ldquo;{request.message}&rdquo;</p>}
          <p className="mt-1 text-xs text-ink-faint">{new Date(request.created_at).toLocaleDateString("es-AR")}</p>
        </Card>
      )}

      {offers && offers.length > 0 && (
        <div className="mt-6 space-y-3">
          {offers.map((o) => {
            const badge = RESIDENCE_OFFER_STATUS_COPY[o.status] ?? { label: o.status, tone: "neutral" as const };
            return (
              <Card key={o.id} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">
                    {o.period_start_date} → {o.period_end_date} ({o.duration_months} meses)
                  </p>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-ink-faint">Tarifa mensual</dt>
                    <dd className="font-medium text-ink">{formatUsd(Number(o.monthly_price_usd))}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Fee EstuRed estimado</dt>
                    <dd className="font-medium text-ink">{formatArs(Number(o.estimated_estured_fee_ars))}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Fecha límite para responder</dt>
                    <dd className="font-medium text-ink">
                      {new Date(o.acceptance_deadline_at).toLocaleString("es-AR")}
                    </dd>
                  </div>
                </dl>
                {o.status === "draft" && (
                  <div className="mt-4">
                    <SendOfferButton offerId={o.id} residenceId={residenceId} reservationId={reservationId} />
                  </div>
                )}
                {o.status === "residence_payment_pending" && (
                  <div className="mt-4">
                    <MarkResidencePaymentReceivedForm
                      offerId={o.id}
                      residenceId={residenceId}
                      reservationId={reservationId}
                    />
                  </div>
                )}
                {o.status === "estured_fee_pending" && (
                  <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-faint">
                    Esperando que el estudiante pague el fee EstuRed. Se confirma automáticamente cuando
                    EstuRed lo valide.
                  </p>
                )}
                {(o.status === "confirmed" || o.status === "receipt_issued") && (
                  <p className="mt-4 rounded-field bg-sage-50 px-4 py-3 text-sm text-sage-800">
                    Renovación confirmada — comprobante emitido para el estudiante.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {canCreateOffer && snapshot && (
        <CreateOfferForm
          reservationId={reservationId}
          residenceId={residenceId}
          renewalRequestId={request?.status === "created_by_student" || request?.status === "notified_to_residence" ? request.id : null}
          currentMonthlyPriceUsd={Number(snapshot.monthly_price_usd)}
          currentDurationMonths={reservation.initial_duration_months}
        />
      )}
    </div>
  );
}
