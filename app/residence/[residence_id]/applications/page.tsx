import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Solicitudes recibidas" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  submitted: { label: "Nueva", tone: "amber" },
  under_review: { label: "En revisión", tone: "amber" },
  contact_established: { label: "Contacto establecido", tone: "sage" },
  offer_pending_student_acceptance: { label: "Propuesta enviada", tone: "amber" },
  conditions_accepted: { label: "Condiciones aceptadas", tone: "sage" },
  paused_due_to_other_active_request: { label: "Pausada", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "neutral" },
  expired_no_residence_response: { label: "Vencida", tone: "neutral" },
  cancelled_by_student: { label: "Cancelada", tone: "neutral" },
};

export default async function ResidenceApplicationsPage({
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

  const { data: applications } = await admin
    .from("application_requests")
    .select(
      "id, status, desired_start_date, created_at, room_types(name), student_profiles(first_name, last_initial)",
    )
    .eq("residence_id", residenceId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">Solicitudes recibidas</h1>
      <p className="mt-1 text-ink-soft">Revisá y respondé las solicitudes de reserva.</p>

      {!applications || applications.length === 0 ? (
        <EmptyState
          title="Todavía no recibiste solicitudes"
          description="Cuando un estudiante envíe una solicitud a esta residencia, va a aparecer acá."
        />
      ) : (
        <div className="mt-8 space-y-4">
          {applications.map((a) => {
            const student = a.student_profiles as unknown as { first_name: string; last_initial: string } | null;
            const roomType = a.room_types as unknown as { name: string } | null;
            const badge = STATUS_COPY[a.status] ?? { label: a.status, tone: "neutral" as const };
            return (
              <Link key={a.id} href={`/residence/${residenceId}/applications/${a.id}`}>
                <Card interactive className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-bold text-petrol-800">
                      {student?.first_name} {student?.last_initial}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {roomType?.name} · Ingreso {a.desired_start_date}
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
