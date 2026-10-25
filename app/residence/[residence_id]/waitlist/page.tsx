import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { PermissionGate } from "@/components/residences/PermissionGate";
import { MOVING_SIGNAL_LABEL } from "@/lib/stayChange/copy";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { daysUntilDesired as computeDaysUntilDesired, describeDaysUntilDesired } from "@/lib/waitlist-entries/daysUntilDesired";
import { WaitlistRowActions } from "@/app/residence/[residence_id]/waitlist/WaitlistRowActions";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  active: { label: "En espera", tone: "neutral" },
  availability_notification_sent: { label: "Avisado — esperando confirmar", tone: "amber" },
  retention_check_sent: { label: "Chequeo de retención enviado", tone: "amber" },
};

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];
const NEEDS_RESPONSE_STATUSES = ["availability_notification_sent", "retention_check_sent"];
const URGENT_WINDOW_DAYS = 14;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 3600 * 1000));
}

/**
 * No hay columna de "prioridad" declarada en waitlist_entries (docs/06 §10.2
 * documenta joined_at como único criterio de orden). El orden por
 * "prioridad" que pide el dueño se deriva acá, sin persistir nada nuevo:
 * primero quien está a mitad de un flujo con el estudiante (avisado /
 * chequeo de retención — tiene una ventana de respuesta corriendo), luego
 * por cercanía de la fecha de ingreso deseada, y por último por antigüedad
 * (FIFO) como desempate. La numeración #1, #2… resultante es "quién debería
 * recibir la próxima vacante" dentro de cada tipo de habitación.
 */
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

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR11: sin el permiso las acciones se ven deshabilitadas (solo presentación; el servidor valida cada acción).
  const canManage = can(membership, "waitlist.manage");

  const { data: entries, error } = await admin
    .from("waitlist_entries")
    .select(
      "id, status, room_type_id, desired_start_date, desired_duration_months, joined_at, student_profiles (first_name, last_initial), room_types (name)",
    )
    .eq("residence_id", residenceId)
    .in("status", ACTIVE_STATUSES)
    .order("joined_at", { ascending: true });
  if (error) console.error("[residence/waitlist] query failed:", error);

  const rows =
    (entries as unknown as {
      id: string;
      status: string;
      room_type_id: string | null;
      desired_start_date: string | null;
      desired_duration_months: number | null;
      joined_at: string;
      student_profiles: { first_name: string; last_initial: string } | null;
      room_types: { name: string } | null;
    }[]) ?? [];

  // DR3b: señal "En proceso de mudanza" en las listas de espera creadas bajo un aviso "Quiero cambiar" (lectura degradable).
  const movingEntryIds = new Set<string>();
  const { data: movingEntries, error: movingError } = await admin
    .from("waitlist_entries")
    .select("id")
    .eq("residence_id", residenceId)
    .in("status", ACTIVE_STATUSES)
    .not("stay_change_intent_id", "is", null);
  if (!movingError) for (const row of movingEntries ?? []) movingEntryIds.add(row.id as string);

  const nowIso = new Date().toISOString();

  const enriched = rows.map((entry) => {
    const waitingDays = daysBetween(entry.joined_at, nowIso);
    const daysUntilDesired = computeDaysUntilDesired(entry.desired_start_date);
    return {
      ...entry,
      waitingDays,
      daysUntilDesired,
      needsResponse: NEEDS_RESPONSE_STATUSES.includes(entry.status),
      urgent: daysUntilDesired !== null && daysUntilDesired <= URGENT_WINDOW_DAYS,
    };
  });

  const groupsMap = new Map<string, { key: string; name: string; entries: typeof enriched }>();
  for (const entry of enriched) {
    const key = entry.room_type_id ?? "__any__";
    const name = entry.room_types?.name ?? "Cualquier tipo de habitación";
    if (!groupsMap.has(key)) groupsMap.set(key, { key, name, entries: [] });
    groupsMap.get(key)!.entries.push(entry);
  }

  const groups = Array.from(groupsMap.values())
    .map((g) => ({
      ...g,
      entries: [...g.entries].sort((a, b) => {
        if (a.needsResponse !== b.needsResponse) return a.needsResponse ? -1 : 1;
        const aUrgent = a.daysUntilDesired ?? Infinity;
        const bUrgent = b.daysUntilDesired ?? Infinity;
        if (aUrgent !== bUrgent) return aUrgent - bUrgent;
        return b.waitingDays - a.waitingDays;
      }),
    }))
    .sort((a, b) => (a.key === "__any__" ? 1 : b.key === "__any__" ? -1 : a.name.localeCompare(b.name)));

  const totalCount = rows.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Lista de espera</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Agrupada por tipo de habitación y ordenada por quién debería recibir la próxima vacante primero.
      </p>

      {totalCount === 0 ? (
        <div className="mt-6">
          <EmptyState icon="hourglass_top" title="Nadie en lista de espera" description="Cuando alguien se sume, va a aparecer acá." />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">{group.name}</h2>
                <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">
                  {group.entries.length}
                </span>
              </div>
              <div className="space-y-3">
                {group.entries.map((entry, i) => {
                  const badge = STATUS_COPY[entry.status] ?? { label: entry.status, tone: "neutral" as const };
                  const position = i + 1;
                  return (
                    <Card key={entry.id} className={`p-5 ${entry.urgent ? "border-danger-fg/30" : ""}`}>
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                            position === 1 ? "bg-forest text-white" : "bg-cream-2 text-ink-soft"
                          }`}
                        >
                          {position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-ink">
                              {formatShortName(entry.student_profiles?.first_name, entry.student_profiles?.last_initial)}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entry.urgent && (
                                <Badge tone="danger">
                                  <Icon name="priority_high" className="text-xs" />
                                  Urgente
                                </Badge>
                              )}
                              {movingEntryIds.has(entry.id) && (
                                <Badge tone="amber">
                                  <Icon name="swap_horiz" className="text-xs" />
                                  {MOVING_SIGNAL_LABEL}
                                </Badge>
                              )}
                              <Badge tone={badge.tone}>{badge.label}</Badge>
                            </div>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {entry.desired_start_date && (
                              <>
                                Ingreso deseado {formatDateOnly(entry.desired_start_date)}
                                {describeDaysUntilDesired(entry.daysUntilDesired) && (
                                  <> ({describeDaysUntilDesired(entry.daysUntilDesired)})</>
                                )}
                              </>
                            )}
                            {entry.desired_duration_months && <> · {entry.desired_duration_months} meses</>}
                          </p>
                          <p className="text-xs text-ink-faint">
                            En lista desde {formatDate(entry.joined_at)} · {entry.waitingDays}{" "}
                            {entry.waitingDays === 1 ? "día" : "días"} de antigüedad
                          </p>
                          <PermissionGate allowed={canManage}>
                            <WaitlistRowActions residenceId={residenceId} entryId={entry.id} />
                          </PermissionGate>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
