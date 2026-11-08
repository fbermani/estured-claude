import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { PremiumNotice } from "@/components/residences/PremiumNotice";
import { hasOperationalManagementAccess } from "@/lib/residences/operationalAccess";
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

  const hasPremium = await hasOperationalManagementAccess(admin, residenceId);

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
    <div className="tone-residence mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {!hasPremium && <PremiumNotice residenceId={residenceId} feature="Renovaciones" className="mb-4" />}
      <ResidenceHero icon="autorenew" title="Renovaciones" subtitle="Mandá una oferta a quien quiera seguir; cada estudiante la responde desde su cuenta." />
      <p className="mt-3 rounded-field bg-amber-soft-100 px-3 py-2 text-xs font-semibold text-ink-soft">
        Solo para estudiantes que reservaron por EstuRed; para el resto, cargalos en Residentes.
      </p>

      {!reservations || reservations.length === 0 ? (
        <EmptyState
          tone="residence"
          icon="sync_alt"
          title="Todavía no hay reservas confirmadas"
          description="Las renovaciones se gestionan para estudiantes que reservaron por EstuRed; para el resto, cargalos en Residentes."
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
                    <p className="font-bold text-ink">
                      {formatShortName(student?.first_name, student?.last_initial)}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {roomType?.name} · Ingreso {formatDateOnly(r.start_date)} · {r.initial_duration_months} meses
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
