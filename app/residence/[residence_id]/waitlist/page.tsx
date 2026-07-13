import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { WaitlistRowActions } from "@/app/residence/[residence_id]/waitlist/WaitlistRowActions";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  active: { label: "En espera", tone: "neutral" },
  availability_notification_sent: { label: "Avisado — esperando confirmar", tone: "amber" },
  retention_check_sent: { label: "Chequeo de retención enviado", tone: "amber" },
};

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];

export default async function ResidenceWaitlistPage({
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

  const { data: entries, error } = await admin
    .from("waitlist_entries")
    .select(
      "id, status, desired_start_date, desired_duration_months, joined_at, student_profiles (first_name, last_initial), room_types (name)",
    )
    .eq("residence_id", residenceId)
    .in("status", ACTIVE_STATUSES)
    .order("joined_at", { ascending: true });
  if (error) console.error("[residence/waitlist] query failed:", error);

  const rows =
    (entries as unknown as {
      id: string;
      status: string;
      desired_start_date: string | null;
      desired_duration_months: number | null;
      joined_at: string;
      student_profiles: { first_name: string; last_initial: string } | null;
      room_types: { name: string } | null;
    }[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Lista de espera</h1>
      <p className="mt-1 text-sm text-ink-soft">Estudiantes esperando lugar en esta residencia.</p>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nadie en lista de espera" description="Cuando alguien se sume, va a aparecer acá." />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((entry) => {
            const badge = STATUS_COPY[entry.status] ?? { label: entry.status, tone: "neutral" as const };
            return (
              <Card key={entry.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {entry.student_profiles?.first_name} {entry.student_profiles?.last_initial}.
                    </p>
                    <p className="text-xs text-ink-faint">
                      {entry.room_types?.name ?? "Cualquier tipo de habitación"}
                      {entry.desired_start_date && <> · Ingreso deseado {entry.desired_start_date}</>}
                      {entry.desired_duration_months && <> · {entry.desired_duration_months} meses</>}
                    </p>
                    <p className="text-xs text-ink-faint">
                      En lista desde {new Date(entry.joined_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <WaitlistRowActions residenceId={residenceId} entryId={entry.id} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
