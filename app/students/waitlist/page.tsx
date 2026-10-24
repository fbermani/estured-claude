import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
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
const NEEDS_ACTION_STATUSES = new Set(["availability_notification_sent", "retention_check_sent"]);

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

  // "Quiero cambiar" (DR3): las entradas creadas bajo un aviso se etiquetan "Por tu cambio de residencia". Lectura aparte y
  // degradable: sin la migración 0044 (o ante un error) la lista se ve igual, sin la etiqueta.
  const changeEntryIds = new Set<string>();
  if (supabase && sessionUser && entries.length > 0) {
    const { data: linked, error: linkedError } = await supabase
      .from("waitlist_entries")
      .select("id")
      .in("id", entries.map((e) => e.id))
      .not("stay_change_intent_id", "is", null);
    if (!linkedError) for (const row of linked ?? []) changeEntryIds.add(row.id as string);
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
            icon="hourglass_top"
            title="No estás en ninguna lista de espera"
            description="Cuando una residencia no tenga lugar, vas a poder sumarte desde su ficha."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {entries.map((entry) => {
            const badge = STATUS_COPY[entry.status] ?? { label: entry.status, tone: "neutral" as const };
            const isActive = ACTIVE_STATUSES.has(entry.status);
            const needsAction = NEEDS_ACTION_STATUSES.has(entry.status);

            const summary = (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{entry.residences?.name}</p>
                  <p className="text-sm text-ink-soft">{entry.residences?.public_area}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {changeEntryIds.has(entry.id) && (
                    <Badge tone="amber">
                      <Icon name="swap_horiz" className="text-sm" /> Por tu cambio de residencia
                    </Badge>
                  )}
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
              </div>
            );

            return (
              <ExpandableCard
                key={entry.id}
                defaultOpen={needsAction}
                className={needsAction ? "border-orange/40 bg-warning-bg" : ""}
                summary={summary}
              >
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-faint">Habitación</dt>
                    <dd className="font-semibold text-ink">{entry.room_types?.name ?? "Cualquier tipo"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Ingreso deseado</dt>
                    <dd className="font-semibold text-ink">{entry.desired_start_date ?? "Flexible"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Duración</dt>
                    <dd className="font-semibold text-ink">
                      {entry.desired_duration_months ? `${entry.desired_duration_months} meses` : "Flexible"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-faint">
                  En lista desde {formatDate(entry.joined_at)}
                </p>

                <div className="mt-4 border-t border-line pt-4">
                  <Link
                    href={`/residencias/${entry.residences?.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink hover:border-forest hover:bg-forest-tint"
                  >
                    Ver ficha de la residencia
                  </Link>
                  {isActive && (
                    <WaitlistEntryCard
                      entryId={entry.id}
                      canActivate={entry.status === "availability_notification_sent"}
                      showStay={entry.status !== "active"}
                    />
                  )}
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
