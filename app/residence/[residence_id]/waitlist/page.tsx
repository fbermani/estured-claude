import { formatDate } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { PermissionNote } from "@/components/residences/PermissionGate";
import { MOVING_SIGNAL_LABEL } from "@/lib/stayChange/copy";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PageHero } from "@/components/ui/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatDesiredMonth,
  isCurrentMonth,
  isCountableWaitlistEntry,
  sortWaitlistEntries,
  toMonthStart,
} from "@/lib/waitlist-entries/desiredMonth";
import { filterBoardEntries, isWaitingConfirmed, NOTIFIABLE_STATUSES } from "@/lib/waitlist-entries/board";
import { WaitlistRowActions } from "@/app/residence/[residence_id]/waitlist/WaitlistRowActions";
import {
  EntryCheckbox,
  SelectGroupToggle,
  WaitlistSelectionProvider,
} from "@/app/residence/[residence_id]/waitlist/WaitlistSelection";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];
const NEEDS_RESPONSE_STATUSES = ["availability_notification_sent", "retention_check_sent"];

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 3600 * 1000));
}

type Params = { q?: string; mes?: string; estado?: string };
type RawParams = Record<string, string | string[] | undefined>;

const STATE_CHIPS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "en-espera", label: "En espera" },
  { value: "avisados", label: "Avisados" },
  { value: "decidieron-esperar", label: "Decidieron esperar" },
];

/**
 * Tablero de la lista de espera (DR40 + DR41): una columna por tipo de habitación («Cualquier tipo» al final), con scroll interno.
 * Dentro de cada columna: «Avisados · esperando respuesta» (entradas `availability_notification_sent`, con la fecha del aviso) y
 * «En espera». El orden es el de DR40 (`sortWaitlistEntries`). Los filtros viajan en la URL (se resuelven en el servidor);
 * solo la selección y la barra de acción son client. No hay columna de "prioridad": el orden se deriva, no se persiste.
 * Defensa en profundidad: las entradas con mes ya terminado no se listan aunque el cron todavía no las haya vencido.
 */
export default async function ResidenceWaitlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ residence_id: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { residence_id: residenceId } = await params;
  const sp = await searchParams;
  // Un parámetro repetido (?q=a&q=b) llega como array: se ignora en vez de romper.
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const mesRaw = str(sp.mes);
  const estadoRaw = str(sp.estado);
  const filter = {
    q: str(sp.q).slice(0, 60),
    mes: /^(all|este-mes|cuando-haya-lugar|\d{4}-\d{2}-01)$/.test(mesRaw) ? mesRaw : "all",
    estado: STATE_CHIPS.some((c) => c.value === estadoRaw) ? estadoRaw : "all",
  };
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

  if (error) {
    return (
      <div className="tone-residence mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHero tone="residence" eyebrow="Lista de espera" eyebrowIcon="hourglass_top" title="Lista de espera" glyph="hourglass_top" />
        <div className="mt-6">
          <EmptyState
            variant="error"
            icon="error"
            title="No pudimos cargar la lista"
            description="Recargá la página en unos segundos. Si sigue pasando, avisale a Soporte."
          />
        </div>
      </div>
    );
  }

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

  // DR3b: señal "En proceso de mudanza" (lectura degradable).
  const movingEntryIds = new Set<string>();
  const { data: movingEntries, error: movingError } = await admin
    .from("waitlist_entries")
    .select("id")
    .eq("residence_id", residenceId)
    .in("status", ACTIVE_STATUSES)
    .not("stay_change_intent_id", "is", null);
  if (!movingError) for (const row of movingEntries ?? []) movingEntryIds.add(row.id as string);

  // DR41: fecha del aviso y «Decidió esperar» (migración 0079; lectura degradable: sin ella se ve igual, sin esas marcas).
  const trackingById = new Map<string, { notified_at: string | null; waiting_confirmed_at: string | null }>();
  const { data: tracking, error: trackingError } = await admin
    .from("waitlist_entries")
    .select("id, notified_at, waiting_confirmed_at")
    .eq("residence_id", residenceId)
    .in("status", ACTIVE_STATUSES);
  if (trackingError && trackingError.code !== "42703" && trackingError.code !== "PGRST204") {
    console.error("[residence/waitlist] tracking read failed:", trackingError);
  }
  if (!trackingError) {
    for (const row of tracking ?? []) {
      trackingById.set(row.id as string, {
        notified_at: (row.notified_at as string | null) ?? null,
        waiting_confirmed_at: (row.waiting_confirmed_at as string | null) ?? null,
      });
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const enriched = rows
    .filter((entry) => isCountableWaitlistEntry(entry, now))
    .map((entry) => {
      const track = trackingById.get(entry.id);
      return {
        ...entry,
        notified_at: track?.notified_at ?? null,
        waiting_confirmed_at: track?.waiting_confirmed_at ?? null,
        waitingDays: daysBetween(entry.joined_at, nowIso),
        needsResponse: NEEDS_RESPONSE_STATUSES.includes(entry.status),
        thisMonth: isCurrentMonth(entry.desired_start_date, now),
        monthLabel: formatDesiredMonth(entry.desired_start_date),
      };
    });

  // Resumen: siempre sobre la lista completa (no cambia con los filtros).
  const totalCount = enriched.length;
  const urgentCount = enriched.filter((e) => e.thisMonth).length;
  const awaitingCount = enriched.filter((e) => e.needsResponse).length;

  const filtered = filterBoardEntries(enriched, filter, now);

  const groupsMap = new Map<string, { key: string; name: string; entries: typeof enriched }>();
  for (const entry of filtered) {
    const key = entry.room_type_id ?? "__any__";
    const name = entry.room_types?.name ?? "Cualquier tipo";
    if (!groupsMap.has(key)) groupsMap.set(key, { key, name, entries: [] });
    groupsMap.get(key)!.entries.push(entry);
  }
  const groups = Array.from(groupsMap.values())
    .map((g) => ({ ...g, entries: sortWaitlistEntries(g.entries) }))
    .sort((a, b) => (a.key === "__any__" ? 1 : b.key === "__any__" ? -1 : a.name.localeCompare(b.name)));

  // Meses con gente (para el filtro), de la lista completa.
  const monthOptions = Array.from(
    new Set(enriched.map((e) => toMonthStart(e.desired_start_date)).filter((m): m is string => m !== null)),
  ).sort();

  const href = (patch: Partial<Params>) => {
    const next = { ...filter, ...patch };
    const qs = new URLSearchParams();
    if (next.q) qs.set("q", next.q);
    if (next.mes !== "all") qs.set("mes", next.mes);
    if (next.estado !== "all") qs.set("estado", next.estado);
    const s = qs.toString();
    return `/residence/${residenceId}/waitlist${s ? `?${s}` : ""}`;
  };
  const filtersActive = filter.q !== "" || filter.mes !== "all" || filter.estado !== "all";
  const pillBase = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold sm:min-h-9";
  const pill = (on: boolean) => `${pillBase} ${on ? "bg-forest text-white" : "bg-cream-2 text-ink-soft hover:bg-forest-tint"}`;

  return (
    <div className="tone-residence mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 sm:py-12">
      <PageHero
        tone="residence"
        eyebrow="Lista de espera"
        eyebrowIcon="hourglass_top"
        title="Lista de espera"
        subtitle="Por tipo de habitación. Elegí a varias personas y avisales que hay lugar de una vez."
        glyph="hourglass_top"
      />

      {totalCount === 0 ? (
        <div className="mt-6">
          <EmptyState tone="residence" icon="hourglass_top" title="Nadie en lista de espera" description="Cuando alguien se sume, va a aparecer acá." />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "En lista", value: totalCount, hot: false },
              { label: "Entran este mes", value: urgentCount, hot: urgentCount > 0 },
              { label: "Esperando respuesta", value: awaitingCount, hot: false },
            ].map((stat) => (
              <Card key={stat.label} className={`px-3 py-3 ${stat.hot ? "border-danger-fg/30" : ""}`}>
                <p className={`text-2xl font-extrabold ${stat.hot ? "text-danger-fg" : "text-ink"}`}>{stat.value}</p>
                <p className="text-xs text-ink-faint">{stat.label}</p>
              </Card>
            ))}
          </div>

          {/* Filtros: viajan en la URL, se resuelven en el servidor. */}
          <div className="space-y-3">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-56">
                <span className="sr-only">Buscar por nombre</span>
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-ink-faint" />
                <input
                  type="search"
                  name="q"
                  defaultValue={filter.q}
                  placeholder="Buscar por nombre"
                  className="min-h-11 w-full rounded-full border-[1.5px] border-line bg-paper pl-10 pr-4 text-sm text-ink focus:border-forest focus:outline-none"
                />
              </label>
              {filter.mes !== "all" && <input type="hidden" name="mes" value={filter.mes} />}
              {filter.estado !== "all" && <input type="hidden" name="estado" value={filter.estado} />}
              <button type="submit" className={`${pillBase} bg-forest-tint text-forest-700 hover:bg-mint`}>
                Buscar
              </button>
              {filtersActive && (
                <Link href={`/residence/${residenceId}/waitlist`} className={`${pillBase} text-ink-soft hover:bg-cream-2`}>
                  Limpiar filtros
                </Link>
              )}
            </form>
            <nav aria-label="Filtros de la lista" className="flex flex-wrap items-center gap-2">
              <Link href={href({ mes: filter.mes === "este-mes" ? "all" : "este-mes" })} className={pill(filter.mes === "este-mes")}>
                Este mes
              </Link>
              <Link
                href={href({ mes: filter.mes === "cuando-haya-lugar" ? "all" : "cuando-haya-lugar" })}
                className={pill(filter.mes === "cuando-haya-lugar")}
              >
                Cuando haya lugar
              </Link>
              {monthOptions.map((m) => (
                <Link key={m} href={href({ mes: filter.mes === m ? "all" : m })} className={pill(filter.mes === m)}>
                  {formatDesiredMonth(m)}
                </Link>
              ))}
              <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />
              {STATE_CHIPS.map((c) => (
                <Link key={c.value} href={href({ estado: c.value })} className={pill(filter.estado === c.value)}>
                  {c.label}
                </Link>
              ))}
            </nav>
            {!canManage && <PermissionNote />}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              tone="residence"
              icon="filter_alt_off"
              title="Nadie coincide con estos filtros"
              description="Probá con otro mes o limpiá los filtros."
              action={
                <Link href={`/residence/${residenceId}/waitlist`} className={`${pillBase} bg-forest text-white`}>
                  Limpiar filtros
                </Link>
              }
            />
          ) : (
            <WaitlistSelectionProvider residenceId={residenceId} canManage={canManage}>
              <div className="-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 lg:snap-none">
                {groups.map((group) => {
                  const notified = group.entries.filter((e) => e.status === "availability_notification_sent");
                  const waiting = group.entries.filter((e) => e.status !== "availability_notification_sent");
                  const selectableIds = waiting
                    .filter((e) => (NOTIFIABLE_STATUSES as readonly string[]).includes(e.status))
                    .map((e) => e.id);
                  return (
                    <section
                      key={group.key}
                      aria-label={`Lista de espera: ${group.name}`}
                      className="w-[85%] shrink-0 snap-start overflow-hidden rounded-card border-[1.5px] border-line bg-cream sm:w-80 lg:min-w-72 lg:flex-1"
                    >
                      <header className="flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="truncate text-sm font-extrabold uppercase tracking-widest text-muted">{group.name}</h2>
                          <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">{group.entries.length}</span>
                        </div>
                        <SelectGroupToggle entryIds={selectableIds} groupName={group.name} />
                      </header>
                      <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
                        {notified.length > 0 && (
                          <div>
                            <h3 className="sticky top-0 z-10 flex items-center gap-1.5 bg-orange-tint px-4 py-1.5 text-xs font-bold text-orange-700">
                              <Icon name="mark_email_read" className="text-base" />
                              Avisados · esperando respuesta
                              <span className="ml-auto">{notified.length}</span>
                            </h3>
                            <ul className="divide-y divide-line">
                              {notified.map((entry) => (
                                <EntryRow key={entry.id} entry={entry} moving={movingEntryIds.has(entry.id)} residenceId={residenceId} canManage={canManage} nowIso={nowIso} />
                              ))}
                            </ul>
                          </div>
                        )}
                        {waiting.length > 0 && (
                          <div>
                            <h3 className="sticky top-0 z-10 flex items-center gap-1.5 bg-cream-2 px-4 py-1.5 text-xs font-bold text-ink-soft">
                              <Icon name="hourglass_top" className="text-base" />
                              En espera
                              <span className="ml-auto">{waiting.length}</span>
                            </h3>
                            <ul className="divide-y divide-line">
                              {waiting.map((entry) => (
                                <EntryRow key={entry.id} entry={entry} moving={movingEntryIds.has(entry.id)} residenceId={residenceId} canManage={canManage} nowIso={nowIso} />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </WaitlistSelectionProvider>
          )}
        </div>
      )}
    </div>
  );
}

type RowEntry = {
  id: string;
  status: string;
  desired_start_date: string | null;
  desired_duration_months: number | null;
  joined_at: string;
  notified_at: string | null;
  waiting_confirmed_at: string | null;
  waitingDays: number;
  thisMonth: boolean;
  monthLabel: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
};

function EntryRow({
  entry,
  moving,
  residenceId,
  canManage,
  nowIso,
}: {
  entry: RowEntry;
  moving: boolean;
  residenceId: string;
  canManage: boolean;
  nowIso: string;
}) {
  const name = formatShortName(entry.student_profiles?.first_name, entry.student_profiles?.last_initial);
  const isNotified = entry.status === "availability_notification_sent";
  const selectable = (NOTIFIABLE_STATUSES as readonly string[]).includes(entry.status);
  const notifiedDays = entry.notified_at ? Math.max(0, daysBetween(entry.notified_at, nowIso)) : null;

  return (
    <li className={`flex items-start gap-1 px-3 py-2 ${entry.thisMonth ? "bg-danger-bg/30" : "bg-paper"}`}>
      {selectable ? (
        <EntryCheckbox entryId={entry.id} label={name} />
      ) : (
        <span aria-hidden className="h-11 w-3 shrink-0" />
      )}
      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          {entry.thisMonth && (
            <Badge tone="danger">
              <Icon name="priority_high" className="text-xs" />
              Este mes
            </Badge>
          )}
          {isWaitingConfirmed(entry) && (
            <Badge tone="sage">
              <Icon name="check_circle" className="text-xs" />
              Decidió esperar · {formatDate(entry.waiting_confirmed_at!)}
            </Badge>
          )}
          {entry.status === "retention_check_sent" && <Badge tone="amber">Chequeo de 90 días</Badge>}
          {moving && (
            <Badge tone="amber">
              <Icon name="swap_horiz" className="text-xs" />
              {MOVING_SIGNAL_LABEL}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          {entry.monthLabel ?? "Cuando haya lugar"}
          {entry.desired_duration_months && <> · {entry.desired_duration_months} meses</>}
          {" · "}en lista hace {entry.waitingDays} {entry.waitingDays === 1 ? "día" : "días"}
        </p>
        {isNotified && (
          <p className="text-xs font-medium text-orange-700">
            {entry.notified_at
              ? `Avisado el ${formatDate(entry.notified_at)}${notifiedDays === 0 ? " (hoy)" : ` (hace ${notifiedDays} ${notifiedDays === 1 ? "día" : "días"})`}`
              : "Avisado: esperando que responda"}
          </p>
        )}
        {canManage ? (
          <WaitlistRowActions residenceId={residenceId} entryId={entry.id} canNotify={selectable} />
        ) : null}
      </div>
    </li>
  );
}
