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
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "sage" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "neutral" },
  expired_no_residence_response: { label: "Vencida — sin respuesta", tone: "neutral" },
  cancelled_by_student: { label: "Cancelada por vos", tone: "neutral" },
};

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-petrol-800">Mis solicitudes</h1>
          <p className="mt-1 text-ink-soft">Seguimiento de tus solicitudes de reserva.</p>
        </div>
        <Button href="/residencias" size="sm">
          Buscar residencia real
        </Button>
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="Todavía no enviaste ninguna solicitud"
          description="Explorá el catálogo de residencias verificadas y enviá tu primera solicitud."
          action={
            <Button href="/residencias" size="sm">
              Ver residencias
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {applications.map((a) => {
            const badge = STATUS_COPY[a.status] ?? { label: a.status, tone: "neutral" as const };
            return (
              <Link key={a.id} href={`/students/applications/${a.id}`}>
                <Card interactive className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-bold text-petrol-800">{a.residences?.name}</p>
                    <p className="text-sm text-ink-soft">
                      {a.room_types?.name} · Ingreso {a.desired_start_date}
                    </p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
