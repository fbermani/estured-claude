import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Mis solicitudes" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "petrol" }> = {
  submitted: { label: "Enviada — esperando respuesta", tone: "amber" },
  queued_for_place: { label: "En cola para este tipo de habitación", tone: "neutral" },
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "sage" },
  offer_pending_student_acceptance: { label: "Te propusieron un ajuste", tone: "amber" },
  conditions_accepted: { label: "Condiciones aceptadas", tone: "sage" },
  residence_payment_pending: { label: "Pagá a la residencia", tone: "amber" },
  residence_payment_reported: { label: "Pago informado", tone: "sage" },
  converted_to_reservation: { label: "Reserva creada", tone: "sage" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "neutral" },
  expired_no_residence_response: { label: "Vencida — sin respuesta", tone: "neutral" },
  expired_offer_no_response: { label: "Vencida — no respondiste a tiempo", tone: "neutral" },
  cancelled_by_student: { label: "Cancelada por vos", tone: "neutral" },
};

/** El estudiante tiene algo concreto que hacer ahora — se muestran primero y con más peso visual. */
const ACTION_REQUIRED_STATUSES = new Set(["offer_pending_student_acceptance", "residence_payment_pending"]);

export default async function StudentApplicationsPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();

  let applications: {
    id: string;
    status: string;
    desired_start_date: string;
    created_at: string;
    residences: { name: string } | null;
    room_types: { name: string } | null;
  }[] = [];

  if (supabase && sessionUser) {
    const { data } = await supabase
      .from("application_requests")
      .select("id, status, desired_start_date, created_at, residences(name), room_types(name)")
      .order("created_at", { ascending: false });
    applications = (data as unknown as typeof applications) ?? [];
  }

  const actionNeeded = applications.filter((a) => ACTION_REQUIRED_STATUSES.has(a.status));
  const rest = applications.filter((a) => !ACTION_REQUIRED_STATUSES.has(a.status));

  const renderCard = (a: (typeof applications)[number], emphasized: boolean) => {
    const badge = STATUS_COPY[a.status] ?? { label: a.status, tone: "neutral" as const };
    return (
      <Link key={a.id} href={`/students/applications/${a.id}`}>
        <Card
          interactive
          className={`flex flex-wrap items-center justify-between gap-3 p-5 ${
            emphasized ? "border-orange/40 bg-warning-bg" : ""
          }`}
        >
          <div>
            <p className="font-bold text-ink">{a.residences?.name}</p>
            <p className="text-sm text-ink-soft">
              {a.room_types?.name} · Ingreso {a.desired_start_date}
            </p>
          </div>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </Card>
      </Link>
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
              <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange" aria-hidden />
                Necesitan tu acción
              </h2>
              <div className="space-y-4">{actionNeeded.map((a) => renderCard(a, true))}</div>
            </div>
          )}
          <div>
            {actionNeeded.length > 0 && (
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">
                Resto de tus solicitudes
              </h2>
            )}
            <div className="space-y-4">{rest.map((a) => renderCard(a, false))}</div>
          </div>
        </div>
      )}
    </div>
  );
}
