import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd, formatArs } from "@/lib/mock/exchange";
import { RespondOfferForm } from "@/app/students/renewals/[id]/RespondOfferForm";

export const metadata: Metadata = { title: "Detalle de renovación" };
export const dynamic = "force-dynamic";

const ADJUSTMENT_LABEL: Record<string, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  none: "Sin ajuste",
};

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  draft: { label: "En preparación por la residencia", tone: "neutral" },
  sent: { label: "Pendiente de tu respuesta", tone: "amber" },
  viewed: { label: "Pendiente de tu respuesta", tone: "amber" },
  accepted_by_student: { label: "Aceptaste esta oferta", tone: "sage" },
  rejected_by_student: { label: "Rechazaste esta oferta", tone: "neutral" },
  expired: { label: "Oferta vencida", tone: "danger" },
};

export default async function StudentRenewalOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  if (!sessionUser || !supabase) notFound();

  const { data: offer, error } = await supabase
    .from("renewal_offers")
    .select(
      "id, status, period_start_date, period_end_date, duration_months, monthly_price_usd, monthly_price_ars, enrollment_or_renewal_fee_usd, deposit_usd, adjustment_policy, estimated_estured_fee_ars, acceptance_deadline_at, residences (name, public_area)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[students/renewals] offer query failed:", error);
  if (!offer) notFound();

  const residence = offer.residences as unknown as { name: string; public_area: string } | null;
  const badge = STATUS_COPY[offer.status] ?? { label: offer.status, tone: "neutral" as const };
  const canRespond = offer.status === "sent" || offer.status === "viewed";
  const withinDeadline = new Date(offer.acceptance_deadline_at) > new Date();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-petrol-800">Oferta de renovación</h1>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {residence?.name} · {residence?.public_area}
      </p>

      <Card className="mt-6 p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-faint">Nuevo período</dt>
            <dd className="font-medium text-ink">
              {offer.period_start_date} → {offer.period_end_date}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Duración</dt>
            <dd className="font-medium text-ink">{offer.duration_months} meses</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Tarifa mensual</dt>
            <dd className="font-medium text-ink">
              {formatUsd(Number(offer.monthly_price_usd))} ({formatArs(Number(offer.monthly_price_ars))})
            </dd>
          </div>
          {offer.enrollment_or_renewal_fee_usd && (
            <div>
              <dt className="text-ink-faint">Matrícula / cargo de renovación</dt>
              <dd className="font-medium text-ink">{formatUsd(Number(offer.enrollment_or_renewal_fee_usd))}</dd>
            </div>
          )}
          {offer.deposit_usd && (
            <div>
              <dt className="text-ink-faint">Depósito</dt>
              <dd className="font-medium text-ink">{formatUsd(Number(offer.deposit_usd))}</dd>
            </div>
          )}
          <div>
            <dt className="text-ink-faint">Política de ajustes</dt>
            <dd className="font-medium text-ink">{ADJUSTMENT_LABEL[offer.adjustment_policy] ?? offer.adjustment_policy}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Fee EstuRed (misma lógica que tu reserva inicial)</dt>
            <dd className="font-medium text-ink">{formatArs(Number(offer.estimated_estured_fee_ars))}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ink-faint">Fecha límite para responder</dt>
            <dd className="font-medium text-ink">{new Date(offer.acceptance_deadline_at).toLocaleString("es-AR")}</dd>
          </div>
        </dl>

        {canRespond && withinDeadline && <RespondOfferForm offerId={offer.id} />}
        {canRespond && !withinDeadline && (
          <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-faint">
            El plazo para responder esta oferta venció.
          </p>
        )}
      </Card>
    </div>
  );
}
