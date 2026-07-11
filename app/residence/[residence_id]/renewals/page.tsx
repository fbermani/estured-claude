import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RESIDENCE_OFFER_STATUS_COPY } from "@/lib/renewals/statusCopy";

export const metadata: Metadata = { title: "Renovaciones" };
export const dynamic = "force-dynamic";

export default async function ResidenceRenewalsPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: reservations } = await admin
    .from("reservations")
    .select("id, start_date, initial_duration_months, student_profiles(first_name, last_initial), room_types(name)")
    .eq("residence_id", residenceId)
    .eq("status", "confirmed")
    .order("start_date", { ascending: true });

  const reservationIds = (reservations ?? []).map((r) => r.id);

  const { data: requests, error: requestsError } = reservationIds.length
    ? await admin.from("renewal_requests").select("id, reservation_id, status").in("reservation_id", reservationIds)
    : { data: [], error: null };
  if (requestsError) console.error("[residence/renewals] renewal_requests query failed:", requestsError);
  const { data: offers, error: offersError } = reservationIds.length
    ? await admin
        .from("renewal_offers")
        .select("id, reservation_id, status, created_at")
        .in("reservation_id", reservationIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (offersError) console.error("[residence/renewals] renewal_offers query failed:", offersError);

  const pendingRequestByReservation = new Map(
    (requests ?? [])
      .filter((r) => r.status === "created_by_student" || r.status === "notified_to_residence")
      .map((r) => [r.reservation_id, r]),
  );
  const latestOfferByReservation = new Map<string, { id: string; status: string }>();
  for (const o of offers ?? []) {
    if (!latestOfferByReservation.has(o.reservation_id)) {
      latestOfferByReservation.set(o.reservation_id, { id: o.id, status: o.status });
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">Renovaciones</h1>
      <p className="mt-1 text-ink-soft">
        Ofrecé renovación a estudiantes con reserva confirmada. El fee de renovación usa exactamente la misma
        lógica que el fee de la reserva inicial.
      </p>

      {!reservations || reservations.length === 0 ? (
        <EmptyState
          title="Todavía no hay reservas confirmadas"
          description="Cuando tengas una reserva confirmada, vas a poder ofrecerle renovación desde acá."
        />
      ) : (
        <div className="mt-8 space-y-4">
          {reservations.map((r) => {
            const student = r.student_profiles as unknown as { first_name: string; last_initial: string } | null;
            const roomType = r.room_types as unknown as { name: string } | null;
            const pendingRequest = pendingRequestByReservation.get(r.id);
            const latestOffer = latestOfferByReservation.get(r.id);
            return (
              <Link key={r.id} href={`/residence/${residenceId}/renewals/${r.id}`}>
                <Card interactive className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-bold text-petrol-800">
                      {student?.first_name} {student?.last_initial}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {roomType?.name} · Ingreso {r.start_date} · {r.initial_duration_months} meses
                    </p>
                  </div>
                  {latestOffer ? (
                    <Badge tone={RESIDENCE_OFFER_STATUS_COPY[latestOffer.status]?.tone ?? "neutral"}>
                      {RESIDENCE_OFFER_STATUS_COPY[latestOffer.status]?.label ?? latestOffer.status}
                    </Badge>
                  ) : pendingRequest ? (
                    <Badge tone="amber">Solicitó renovación</Badge>
                  ) : (
                    <Badge tone="neutral">Sin oferta</Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
