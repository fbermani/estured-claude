import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { StartRenewalModal } from "@/app/students/renewals/StartRenewalModal";
import { formatDateOnly } from "@/lib/students/contractEnd";
import { loadStudentContracts, type StudentContract } from "@/lib/students/loadStudentContracts";
import { StayRateNote } from "@/components/students/StayRateNote";

export const metadata: Metadata = { title: "Renovaciones" };
export const dynamic = "force-dynamic";

const OFFER_STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  draft: { label: "En preparación por la residencia", tone: "neutral" },
  sent: { label: "Oferta recibida", tone: "amber" },
  viewed: { label: "Oferta recibida", tone: "amber" },
  accepted_by_student: { label: "Aceptaste la renovación", tone: "sage" },
  rejected_by_student: { label: "Rechazaste la oferta", tone: "neutral" },
  expired: { label: "Oferta vencida", tone: "danger" },
  residence_payment_pending: { label: "Pagá a la residencia", tone: "amber" },
  estured_fee_pending: { label: "Pagá el fee EstuRed", tone: "amber" },
  confirmed: { label: "Renovación confirmada", tone: "sage" },
  receipt_issued: { label: "Renovación confirmada", tone: "sage" },
};

type ReservationRow = {
  id: string;
  start_date: string;
  initial_duration_months: number;
  status: string;
  residences: { name: string; public_area: string; minimum_stay_months: number | null } | null;
  room_types: { name: string } | null;
  application_snapshots: { monthly_price_usd: number } | null;
};

export default async function StudentRenewalsPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();

  let reservations: ReservationRow[] = [];
  const requestsByReservation = new Map<string, { id: string; status: string }>();
  const offersByReservation = new Map<string, { id: string; status: string }[]>();
  let contracts = new Map<string, StudentContract>();

  if (supabase && sessionUser) {
    const { data } = await supabase
      .from("reservations")
      .select(
        "id, start_date, initial_duration_months, status, residences (name, public_area, minimum_stay_months), room_types (name), application_snapshots (monthly_price_usd)",
      )
      .eq("status", "confirmed");
    reservations = (data as unknown as ReservationRow[]) ?? [];

    // H05: fin de contrato y tarifa vigentes (estadía vinculada → renovación → reserva).
    contracts = await loadStudentContracts(
      supabase,
      reservations.map((r) => ({
        id: r.id,
        start_date: r.start_date,
        initial_duration_months: r.initial_duration_months,
        snapshotRateUsd: r.application_snapshots?.monthly_price_usd ?? null,
      })),
    );

    const ids = reservations.map((r) => r.id);
    if (ids.length > 0) {
      const { data: requests, error: requestsError } = await supabase
        .from("renewal_requests")
        .select("id, reservation_id, status")
        .in("reservation_id", ids)
        .order("created_at", { ascending: false });
      if (requestsError) console.error("[students/renewals] renewal_requests query failed:", requestsError);
      for (const r of requests ?? []) {
        if (!requestsByReservation.has(r.reservation_id)) requestsByReservation.set(r.reservation_id, r);
      }

      const { data: offers, error: offersError } = await supabase
        .from("renewal_offers")
        .select("id, reservation_id, status")
        .in("reservation_id", ids)
        .order("created_at", { ascending: false });
      if (offersError) console.error("[students/renewals] renewal_offers query failed:", offersError);
      for (const o of offers ?? []) {
        const list = offersByReservation.get(o.reservation_id) ?? [];
        list.push(o);
        offersByReservation.set(o.reservation_id, list);
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Renovaciones</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Solicitá renovar tu estadía o revisá las ofertas de renovación que te envió la residencia.
      </p>

      {reservations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="sync"
            title="No tenés reservas confirmadas"
            description="La renovación aplica solo a reservas confirmadas."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reservations.map((r) => {
            const request = requestsByReservation.get(r.id);
            const offers = offersByReservation.get(r.id) ?? [];
            const activeRequest =
              request && (request.status === "created_by_student" || request.status === "notified_to_residence");
            const latestOffer = offers[0];
            const contract = contracts.get(r.id);
            const remaining = contract?.daysRemaining ?? 0;
            const contractEndLabel = contract ? formatDateOnly(contract.endDate) : "—";

            const summaryBadge = latestOffer
              ? (OFFER_STATUS_COPY[latestOffer.status] ?? { label: latestOffer.status, tone: "neutral" as const })
              : activeRequest
                ? { label: "Solicitud enviada", tone: "amber" as const }
                : { label: "Sin renovación en curso", tone: "neutral" as const };

            const summary = (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{r.residences?.name}</p>
                  <p className="text-sm text-ink-soft">{r.residences?.public_area}</p>
                </div>
                <Badge tone={summaryBadge.tone}>{summaryBadge.label}</Badge>
              </div>
            );

            return (
              <ExpandableCard key={r.id} defaultOpen={Boolean(latestOffer)} summary={summary}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-ink-faint">Ingreso</dt>
                    <dd className="font-semibold text-ink">{r.start_date}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Duración inicial</dt>
                    <dd className="font-semibold text-ink">{r.initial_duration_months} meses</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">{contract?.renewedUntil ? "Renovada hasta" : "Fin del contrato"}</dt>
                    <dd className="font-semibold text-ink">{contractEndLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Restante</dt>
                    <dd className="font-semibold text-ink">{remaining > 0 ? `${remaining} días` : "Vencido"}</dd>
                  </div>
                </dl>
                {contract?.renewedUntil && (
                  <p className="mt-3 text-xs text-ink-faint">
                    Tu contrato original terminaba el {formatDateOnly(contract.originalEndDate)}; lo renovaste.
                  </p>
                )}
                {contract?.differs && (
                  <StayRateNote agreedRateUsd={contract.agreedRateUsd} currentRateUsd={contract.currentRateUsd} className="mt-3" />
                )}

                <div className="mt-4 border-t border-line pt-4">
                  {offers.length > 0 ? (
                    <div className="space-y-2">
                      {offers.map((o) => {
                        const badge = OFFER_STATUS_COPY[o.status] ?? { label: o.status, tone: "neutral" as const };
                        return (
                          <Link
                            key={o.id}
                            href={`/students/renewals/${o.id}`}
                            className="flex items-center justify-between rounded-field border border-sand-200 px-4 py-3 hover:bg-sand-50"
                          >
                            <span className="text-sm font-medium text-ink">Ver oferta de renovación</span>
                            <Badge tone={badge.tone}>{badge.label}</Badge>
                          </Link>
                        );
                      })}
                    </div>
                  ) : activeRequest ? (
                    <p className="rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-faint">
                      Ya enviaste tu solicitud de renovación — esperando que la residencia responda.
                    </p>
                  ) : (
                    <StartRenewalModal
                      reservationId={r.id}
                      roomTypeName={r.room_types?.name ?? null}
                      currentEndDateLabel={contractEndLabel}
                      monthlyPriceUsd={contract?.currentRateUsd ?? r.application_snapshots?.monthly_price_usd ?? null}
                      minimumStayMonths={r.residences?.minimum_stay_months ?? null}
                      triggerLabel="Iniciar renovación"
                    />
                  )}
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
