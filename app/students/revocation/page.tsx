import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RevocationForm } from "@/app/students/revocation/RevocationForm";
import {
  REVOCATION_NOT_ALLOWED_NOTE,
  REVOCATION_PAGE_INTRO,
  REVOCATION_PENDING_HELPER,
} from "@/lib/revocations/copy";
import { REVOCATION_WINDOW_DAYS, isRevocationWindowOpen, revocationDaysRemaining } from "@/lib/revocations/window";

export const metadata: Metadata = { title: "Botón de arrepentimiento — Revocación del fee" };
export const dynamic = "force-dynamic";

type ReservationRow = {
  id: string;
  status: string;
  cancellation_reason_code: string | null;
  cancelled_at: string | null;
  student_profile_id: string;
  residences: { name: string; public_area: string } | null;
  estured_fee_payments: { id: string; status: string; paid_at: string | null; payer_user_id: string } | null;
};

type ResolutionRow = {
  id: string;
  status: string;
  refunded_at: string | null;
  revocation_resolution?: string | null;
  revocation_student_message?: string | null;
};

export default async function RevocationPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();

  const { data, error } = sessionUser && supabase
    ? await supabase
        .from("reservations")
        .select(
          // Hint de FK explícito: reservations ↔ estured_fee_payments tiene
          // 2 FKs (una en cada dirección) — el embed implícito es ambiguo
          // y falla en silencio (PGRST201) sin este hint.
          "id, status, cancellation_reason_code, cancelled_at, student_profile_id, residences (name, public_area), estured_fee_payments!reservations_estured_fee_payment_fk (id, status, paid_at, payer_user_id)",
        )
        .not("estured_fee_payment_id", "is", null)
    : { data: null, error: null };
  if (error) console.error("[revocation] reservations query failed:", error);

  const reservations = (data ?? []) as unknown as ReservationRow[];

  // Solo el estudiante dueño de la reserva o quien pagó el fee puede revocar (el servidor lo vuelve a comprobar).
  const { data: ownProfile, error: ownProfileError } = sessionUser && supabase
    ? await supabase.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle()
    : { data: null, error: null };
  if (ownProfileError) console.error("[revocation] student_profiles query failed:", ownProfileError);
  const canRevoke = (r: ReservationRow) =>
    Boolean(sessionUser) &&
    (r.student_profile_id === ownProfile?.id || r.estured_fee_payments?.payer_user_id === sessionUser?.id);

  const confirmed = reservations.filter(
    (r) => r.status === "confirmed" && r.estured_fee_payments?.status === "paid" && r.estured_fee_payments.paid_at,
  );
  const revoked = reservations.filter(
    (r) => r.status === "cancelled_by_student" && r.cancellation_reason_code === "student_revocation_right" && canRevoke(r),
  );

  // La resolución del admin y su mensaje solo los lee el servidor (columnas sin grant, migración 0049), y solo de las revocaciones
  // que el usuario ya pudo ver por RLS y que le corresponden.
  const resolutions = new Map<string, ResolutionRow>();
  const admin = getSupabaseAdmin();
  const feeIds = revoked.map((r) => r.estured_fee_payments?.id).filter((id): id is string => Boolean(id));
  if (admin && feeIds.length > 0) {
    let rows: ResolutionRow[] | null = null;
    let resolutionError: { code?: string | null; message?: string | null } | null = null;
    const full = await admin
      .from("estured_fee_payments")
      .select("id, status, refunded_at, revocation_resolution, revocation_student_message")
      .in("id", feeIds);
    if (full.error && isMissingSchemaError(full.error)) {
      // Migración 0049 sin aplicar: se muestra "en revisión" (o "reintegrada" si el fee ya figura así).
      const basic = await admin.from("estured_fee_payments").select("id, status, refunded_at").in("id", feeIds);
      rows = (basic.data ?? []) as ResolutionRow[];
      resolutionError = basic.error;
    } else {
      rows = (full.data ?? []) as ResolutionRow[];
      resolutionError = full.error;
    }
    if (resolutionError) console.error("[revocation] resolution query failed:", resolutionError);
    for (const row of rows) resolutions.set(row.id, row);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Botón de arrepentimiento</h1>
      <p className="mt-2 text-sm text-ink-soft">{REVOCATION_PAGE_INTRO}</p>

      {confirmed.length === 0 && revoked.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="undo"
            title="No tenés reservas con fee revocable"
            description="Este derecho aplica solo a reservas confirmadas con el fee EstuRed pagado."
          />
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="mt-6 space-y-4">
          {confirmed.map((r) => {
            const paidAtIso = r.estured_fee_payments!.paid_at!;
            const paidAt = new Date(paidAtIso);
            const daysRemaining = revocationDaysRemaining(paidAtIso);
            const withinWindow = isRevocationWindowOpen(paidAtIso);
            const allowed = canRevoke(r);

            return (
              <Card key={r.id} className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {r.residences?.name} · {r.residences?.public_area}
                  </p>
                  <Badge tone={withinWindow ? "amber" : "neutral"}>
                    {withinWindow ? "Dentro de plazo" : "Fuera de plazo"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-faint">Fee pagado el {formatDate(paidAt)}.</p>

                {!allowed ? (
                  <p className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">{REVOCATION_NOT_ALLOWED_NOTE}</p>
                ) : withinWindow ? (
                  <RevocationForm
                    reservationId={r.id}
                    residenceName={r.residences?.name ?? "la residencia"}
                    daysRemaining={daysRemaining}
                  />
                ) : (
                  <p className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-faint">
                    El plazo de {REVOCATION_WINDOW_DAYS} días corridos para revocar el fee de esta reserva ya venció.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {revoked.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Revocaciones registradas</h2>
          <div className="mt-3 space-y-3">
            {revoked.map((r) => {
              const resolution = r.estured_fee_payments ? resolutions.get(r.estured_fee_payments.id) : undefined;
              const state =
                resolution?.revocation_resolution === "denied"
                  ? "denied"
                  : resolution?.revocation_resolution === "refunded" || resolution?.status === "refunded"
                    ? "refunded"
                    : "pending";
              const message = resolution?.revocation_student_message?.trim() || null;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {r.residences?.name} · {r.residences?.public_area}
                    </p>
                    {state === "pending" && <Badge tone="amber">En revisión por EstuRed</Badge>}
                    {state === "refunded" && <Badge tone="sage">Fee reintegrado</Badge>}
                    {state === "denied" && <Badge tone="neutral">No correspondió el reintegro</Badge>}
                  </div>
                  {r.cancelled_at && <p className="mt-1 text-xs text-ink-faint">Revocaste el {formatDate(r.cancelled_at)}.</p>}
                  {state === "pending" && <p className="mt-2 text-sm text-ink-soft">{REVOCATION_PENDING_HELPER}</p>}
                  {state === "refunded" && (
                    <p className="mt-2 text-sm text-ink-soft">
                      EstuRed te reintegró el fee{resolution?.refunded_at ? ` el ${formatDate(resolution.refunded_at)}` : ""}.
                    </p>
                  )}
                  {state === "denied" && (
                    <p className="mt-2 text-sm text-ink-soft">Revisamos tu revocación y no correspondió reintegrar el fee.</p>
                  )}
                  {state !== "pending" && message && (
                    <p className="mt-2 rounded-field bg-cream-2 p-3 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Mensaje de EstuRed: </span>
                      {message}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
