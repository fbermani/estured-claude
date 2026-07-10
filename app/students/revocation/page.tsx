import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RevocationForm } from "@/app/students/revocation/RevocationForm";

export const metadata: Metadata = { title: "Botón de arrepentimiento — Revocación del fee" };
export const dynamic = "force-dynamic";

const REVOCATION_WINDOW_DAYS = 10;

type ReservationRow = {
  id: string;
  status: string;
  cancellation_reason_code: string | null;
  residences: { name: string; public_area: string } | null;
  estured_fee_payments: { id: string; status: string; paid_at: string | null } | null;
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
          "id, status, cancellation_reason_code, residences (name, public_area), estured_fee_payments!reservations_estured_fee_payment_fk (id, status, paid_at)",
        )
        .not("estured_fee_payment_id", "is", null)
    : { data: null, error: null };
  if (error) console.error("[revocation] reservations query failed:", error);

  const reservations = (data ?? []) as unknown as ReservationRow[];

  const revocable = reservations.filter(
    (r) => r.status === "confirmed" && r.estured_fee_payments?.status === "paid" && r.estured_fee_payments.paid_at,
  );
  const alreadyRevoked = reservations.filter(
    (r) => r.status === "cancelled_by_student" && r.cancellation_reason_code === "student_revocation_right",
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">Botón de arrepentimiento</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Derecho de revocación del fee EstuRed dentro de los 10 días corridos desde el pago (requisito de
        contratación a distancia). No alcanza a montos pagados directamente a la residencia.
      </p>

      {revocable.length === 0 && alreadyRevoked.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No tenés reservas con fee revocable"
            description="Este derecho aplica solo a reservas confirmadas con el fee EstuRed pagado."
          />
        </div>
      )}

      {revocable.length > 0 && (
        <div className="mt-6 space-y-4">
          {revocable.map((r) => {
            const paidAt = new Date(r.estured_fee_payments!.paid_at!);
            const daysSincePaid = (Date.now() - paidAt.getTime()) / (24 * 3_600_000);
            const daysRemaining = Math.max(0, Math.ceil(REVOCATION_WINDOW_DAYS - daysSincePaid));
            const withinWindow = daysSincePaid < REVOCATION_WINDOW_DAYS;

            return (
              <Card key={r.id} className="p-6">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">
                    {r.residences?.name} · {r.residences?.public_area}
                  </p>
                  <Badge tone={withinWindow ? "amber" : "neutral"}>
                    {withinWindow ? "Dentro de plazo" : "Fuera de plazo"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  Fee pagado el {paidAt.toLocaleDateString("es-AR")}.
                </p>

                {withinWindow ? (
                  <RevocationForm
                    reservationId={r.id}
                    residenceName={r.residences?.name ?? "la residencia"}
                    daysRemaining={daysRemaining}
                  />
                ) : (
                  <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-faint">
                    El plazo de 10 días corridos para revocar el fee de esta reserva ya venció.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {alreadyRevoked.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Revocaciones registradas
          </h2>
          <div className="mt-3 space-y-3">
            {alreadyRevoked.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <p className="text-sm text-ink">
                  {r.residences?.name} · {r.residences?.public_area}
                </p>
                <Badge tone="sage">En revisión por EstuRed</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
