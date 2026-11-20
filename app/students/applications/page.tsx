import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadFamilyOverview } from "@/lib/family/loadFamilyOverview";
import { FamilyApplicationsList } from "@/components/students/FamilyApplicationsList";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { effectiveContactDeadline } from "@/lib/applications/paymentDeadline";
import { FeeDeadlineNote } from "@/components/applications/FeeDeadlineNote";
import { ContactDeadlineNote } from "@/components/applications/ContactDeadlineNote";
import { getVisibleStatus } from "@/lib/applications/visibleStatus";
import { loadReservationInfoByApplication, type ReservationInfo } from "@/lib/applications/loadReservationInfo";
import { loadAgreedConditionsByApplication } from "@/lib/applications/loadApplicationSnapshots";
import type { AgreedConditions } from "@/lib/applications/agreedConditions";

export const metadata: Metadata = { title: "Mis solicitudes" };
export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  status: string;
  desired_start_date: string;
  initial_duration_months: number;
  academic_objective: string | null;
  created_at: string;
  payment_deadline_at: string | null;
  contact_established_at: string | null;
  residences: { name: string; public_area: string } | null;
  snapshot_original_id: string | null;
  snapshot_final_id: string | null;
  room_types: { name: string } | null;
};

export default async function StudentApplicationsPage() {
  const sessionUser = await getSessionUser();

  // DR4: el familiar vinculado ve las solicitudes y reservas del estudiante en solo lectura (tercera persona).
  if (sessionUser?.roles.includes("family_member") && !sessionUser.roles.includes("student")) {
    const admin = getSupabaseAdmin();
    const overview = admin ? await loadFamilyOverview(admin, sessionUser.id) : [];
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold text-ink">Solicitudes</h1>
        <p className="mt-1 text-ink-soft">Seguimiento, en solo lectura, de las solicitudes y reservas de quien acompañás.</p>
        <div className="mt-8 space-y-6">
          {overview.length === 0 ? (
            <EmptyState
              icon="family_restroom"
              title="Todavía no acompañás a ningún estudiante"
              description="Cuando un estudiante apruebe tu vinculación, vas a ver acá sus solicitudes."
            />
          ) : (
            overview.map((s) => (
              <Card key={s.linkId} className="p-5 sm:p-6">
                <h2 className="mb-4 font-bold text-ink">Solicitudes de {s.studentShortName}</h2>
                <FamilyApplicationsList applications={s.applications} studentName={s.studentFirstName} />
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServer();

  let applications: ApplicationRow[] = [];
  let reservationByAppId = new Map<string, ReservationInfo>();
  let conditionsByAppId = new Map<string, AgreedConditions>();

  if (supabase && sessionUser) {
    const { data } = await supabase
      .from("application_requests")
      .select(
        "id, status, desired_start_date, initial_duration_months, academic_objective, created_at, payment_deadline_at, contact_established_at, residences(name, public_area), snapshot_original_id, snapshot_final_id, room_types(name)",
      )
      .order("created_at", { ascending: false });
    applications = (data as unknown as ApplicationRow[]) ?? [];

    const convertedIds = applications.filter((a) => a.status === "converted_to_reservation").map((a) => a.id);
    [reservationByAppId, conditionsByAppId] = await Promise.all([
      loadReservationInfoByApplication(supabase, convertedIds),
      // H07: el importe sale del snapshot (final si existe, si no el original), no del precio vigente.
      loadAgreedConditionsByApplication(supabase, applications),
    ]);
  }

  // H01: el estado visible sale de solicitud + reserva (la reserva manda).
  const visibleById = new Map(
    applications.map((a) => [
      a.id,
      getVisibleStatus({ applicationStatus: a.status, reservation: reservationByAppId.get(a.id), viewer: "student" }),
    ]),
  );
  const actionNeeded = applications.filter((a) => visibleById.get(a.id)?.studentActionRequired);
  const rest = applications.filter((a) => !visibleById.get(a.id)?.studentActionRequired);
  // Activas arriba; las cerradas (vencidas, rechazadas, finalizadas) van plegadas como historial.
  const inProgress = rest.filter((a) => !visibleById.get(a.id)?.isClosed);
  const history = rest.filter((a) => visibleById.get(a.id)?.isClosed);
  // El objetivo académico suele ser el mismo en todas las solicitudes: se muestra una sola vez.
  const shownObjectives = new Set<string>();

  const renderCard = (a: ApplicationRow, emphasized: boolean) => {
    const copy = visibleById.get(a.id)!;
    const reservation = reservationByAppId.get(a.id);

    const summary = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{a.residences?.name}</p>
          <p className="text-sm text-ink-soft">
            {a.room_types?.name} · Ingreso {formatDateOnly(a.desired_start_date)}
          </p>
        </div>
        <Badge tone={copy.tone}>{copy.label}</Badge>
      </div>
    );

    return (
      <ExpandableCard
        key={a.id}
        defaultOpen={emphasized}
        className={emphasized ? "border-orange/40 bg-warning-bg" : ""}
        summary={summary}
      >
        {copy.helper && <p className="rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">{copy.helper}</p>}
        {reservation?.status === "pending_estured_fee" && reservation.feePaymentStatus === "pending_payment_method" && (
          <FeeDeadlineNote expiresAt={reservation.feeExpiresAt} className="mt-3" />
        )}
        {a.status === "contact_established" && <ContactDeadlineNote deadlineAt={effectiveContactDeadline(a.payment_deadline_at, a.contact_established_at)} className="mt-3" />}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-faint">Habitación</dt>
            <dd className="font-semibold text-ink">{a.room_types?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Duración</dt>
            <dd className="font-semibold text-ink">{a.initial_duration_months} meses</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Tarifa mensual</dt>
            <dd className="font-semibold text-ink">
              {conditionsByAppId.get(a.id)?.monthlyUsd ? `USD ${conditionsByAppId.get(a.id)!.monthlyUsd}/mes` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Enviada</dt>
            <dd className="font-semibold text-ink">{formatDate(a.created_at)}</dd>
          </div>
        </dl>

        {a.academic_objective && !shownObjectives.has(a.academic_objective.trim()) && shownObjectives.add(a.academic_objective.trim()) && (
          <p className="mt-4 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Tu objetivo académico:</span> {a.academic_objective}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
          {copy.nextAction === "respond_offer" && (
            <Link
              href={`/students/applications/${a.id}/negotiation`}
              className="flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600"
            >
              <Icon name="handshake" className="text-base" /> Ver propuesta de ajuste
            </Link>
          )}
          {copy.nextAction === "pay_fee" && (
            <Link
              href={`/students/applications/${a.id}/fee`}
              className="flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600"
            >
              <Icon name="payments" className="text-base" /> Pagar fee EstuRed
            </Link>
          )}
          {copy.nextAction === "view_fee_status" && reservation?.status === "pending_estured_fee" && (
            <Link
              href={`/students/applications/${a.id}/fee`}
              className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
            >
              <Icon name="payments" className="text-base text-forest-700" /> Ver estado del fee
            </Link>
          )}
          {copy.nextAction === "view_receipt" && reservation?.bookingReceiptId && (
            <Link
              href={`/students/receipts/${reservation.bookingReceiptId}`}
              className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
            >
              <Icon name="receipt_long" className="text-base text-forest-700" /> Ver comprobante
            </Link>
          )}
          {copy.nextAction === "contact_support" && (
            <Link
              href="/students/support"
              className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
            >
              <Icon name="support_agent" className="text-base text-forest-700" /> Escribir a Soporte
            </Link>
          )}
          <Link
            href={`/students/applications/${a.id}`}
            className="flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
          >
            <Icon name="open_in_new" className="text-base" /> Ver detalle completo
          </Link>
        </div>
      </ExpandableCard>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Mis solicitudes</h1>
          <p className="mt-1 text-ink-soft">Seguimiento de tus solicitudes de reserva.</p>
        </div>
        <Button href="/search" size="sm">
          Buscar residencias
        </Button>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Todavía no enviaste ninguna solicitud"
          description="Explorá el catálogo de residencias verificadas y enviá tu primera solicitud."
          action={
            <Button href="/search" size="sm">
              Ver residencias
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {actionNeeded.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange" aria-hidden />
                Necesitan tu acción
              </h2>
              <div className="space-y-4">{actionNeeded.map((a) => renderCard(a, true))}</div>
            </div>
          )}
          {inProgress.length > 0 && (
            <div>
              {(actionNeeded.length > 0 || history.length > 0) && (
                <h2 className="mb-3 text-sm font-bold text-muted">{actionNeeded.length > 0 ? "Otras solicitudes en curso" : "En curso"}</h2>
              )}
              <div className="space-y-4">{inProgress.map((a) => renderCard(a, false))}</div>
            </div>
          )}
          {history.length > 0 && (
            <details className="group" open={actionNeeded.length === 0 && inProgress.length === 0 && history.length <= 2}>
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm font-bold text-muted marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
                Historial ({history.length})
                <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="mb-3 text-sm text-ink-soft">Solicitudes ya cerradas: vencidas, rechazadas o finalizadas.</p>
              <div className="space-y-4">{history.map((a) => renderCard(a, false))}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
