import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestRenewalForm } from "@/app/students/renewals/RequestRenewalForm";

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
  residences: { name: string; public_area: string } | null;
};

export default async function StudentRenewalsPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();

  let reservations: ReservationRow[] = [];
  const requestsByReservation = new Map<string, { id: string; status: string }>();
  const offersByReservation = new Map<string, { id: string; status: string }[]>();

  if (supabase && sessionUser) {
    const { data } = await supabase
      .from("reservations")
      .select("id, start_date, initial_duration_months, status, residences (name, public_area)")
      .eq("status", "confirmed");
    reservations = (data as unknown as ReservationRow[]) ?? [];

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
      <h1 className="text-2xl font-bold text-petrol-800">Renovaciones</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Solicitá renovar tu estadía o revisá las ofertas de renovación que te envió la residencia.
      </p>

      {reservations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No tenés reservas confirmadas"
            description="La renovación aplica solo a reservas confirmadas."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {reservations.map((r) => {
            const request = requestsByReservation.get(r.id);
            const offers = offersByReservation.get(r.id) ?? [];
            const activeRequest =
              request && (request.status === "created_by_student" || request.status === "notified_to_residence");

            return (
              <Card key={r.id} className="p-6">
                <p className="font-semibold text-ink">
                  {r.residences?.name} · {r.residences?.public_area}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Ingreso {r.start_date} · {r.initial_duration_months} meses
                </p>

                {offers.length > 0 ? (
                  <div className="mt-4 space-y-2">
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
                  <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-faint">
                    Ya enviaste tu solicitud de renovación — esperando que la residencia responda.
                  </p>
                ) : (
                  <RequestRenewalForm reservationId={r.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
