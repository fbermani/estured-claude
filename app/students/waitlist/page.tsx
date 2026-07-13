import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { WaitlistEntryCard } from "@/app/students/waitlist/WaitlistEntryCard";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  active: { label: "En lista de espera", tone: "neutral" },
  availability_notification_sent: { label: "¡Hay lugar! Confirmá tu interés", tone: "amber" },
  retention_check_sent: { label: "¿Seguís interesado?", tone: "amber" },
  student_activated_request: { label: "Solicitud activada", tone: "sage" },
  removed_by_student: { label: "Saliste de la lista", tone: "neutral" },
  removed_due_to_confirmed_reservation: { label: "Saliste — confirmaste otra reserva", tone: "neutral" },
  removed_by_residence: { label: "La residencia te sacó de la lista", tone: "neutral" },
  removed_by_admin: { label: "EstuRed te sacó de la lista", tone: "neutral" },
  closed_by_residence: { label: "La residencia cerró la lista", tone: "neutral" },
};

const ACTIVE_STATUSES = new Set(["active", "availability_notification_sent", "retention_check_sent"]);

type WaitlistRow = {
  id: string;
  status: string;
  desired_start_date: string | null;
  desired_duration_months: number | null;
  joined_at: string;
  residences: { name: string; public_area: string; slug: string } | null;
  room_types: { name: string } | null;
};

export default async function StudentWaitlistPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();

  let entries: WaitlistRow[] = [];
  if (supabase && sessionUser) {
    const { data, error } = await supabase
      .from("waitlist_entries")
      .select(
        "id, status, desired_start_date, desired_duration_months, joined_at, residences (name, public_area, slug), room_types (name)",
      )
      .order("joined_at", { ascending: false });
    if (error) console.error("[students/waitlist] query failed:", error);
    entries = (data as unknown as WaitlistRow[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Lista de espera</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Residencias sin lugar hoy a las que te sumaste — no cuenta como solicitud activa.
      </p>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No estás en ninguna lista de espera"
            description="Cuando una residencia no tenga lugar, vas a poder sumarte desde su ficha."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {entries.map((entry) => {
            const badge = STATUS_COPY[entry.status] ?? { label: entry.status, tone: "neutral" as const };
            const isActive = ACTIVE_STATUSES.has(entry.status);
            return (
              <Card key={entry.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/residencias/${entry.residences?.slug}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      {entry.residences?.name}
                    </Link>
                    <p className="text-xs text-ink-faint">{entry.residences?.public_area}</p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {entry.room_types?.name ?? "Cualquier tipo de habitación"}
                  {entry.desired_start_date && <> · Ingreso deseado {entry.desired_start_date}</>}
                  {entry.desired_duration_months && <> · {entry.desired_duration_months} meses</>}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  En lista desde {new Date(entry.joined_at).toLocaleDateString("es-AR")}
                </p>
                {isActive && (
                  <WaitlistEntryCard
                    entryId={entry.id}
                    canActivate={entry.status === "availability_notification_sent"}
                    showStay={entry.status !== "active"}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
