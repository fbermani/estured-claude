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
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { ScrollTable } from "@/components/ui/ScrollTable";
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
  SelectAllCheckbox,
  WaitlistSelectionProvider,
} from "@/app/residence/[residence_id]/waitlist/WaitlistSelection";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];
const NEEDS_RESPONSE_STATUSES = ["availability_notification_sent", "retention_check_sent"];

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 3600 * 1000));
}

type Params = { q?: string; mes?: string; estado?: string; orden?: string; dir?: string };

type SortKey = "persona" | "tipo" | "ingreso" | "espera" | "estado";
const SORT_KEYS: SortKey[] = ["persona", "tipo", "ingreso", "espera", "estado"];
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "persona", label: "Persona" },
  { key: "tipo", label: "Tipo de habitación" },
  { key: "ingreso", label: "Ingreso" },
  { key: "espera", label: "En lista" },
  { key: "estado", label: "Estado" },
];
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
    // Orden por columna (viaja en la URL, se resuelve en el servidor). Sin `orden`: por tipo y, dentro, el orden de DR40.
    orden: (SORT_KEYS as string[]).includes(str(sp.orden)) ? str(sp.orden) : "",
    dir: str(sp.dir) === "desc" ? "desc" : "asc",
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
        <h1 className="font-display text-[1.75rem] font-bold text-(--tone-ink) md:text-4xl">Lista de espera</h1>
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

  const totalCount = enriched.length;

  const filtered = filterBoardEntries(enriched, filter, now);

  const typeName = (e: (typeof enriched)[number]) => e.room_types?.name ?? "Cualquier tipo";
  const shownName = (e: (typeof enriched)[number]) => formatShortName(e.student_profiles?.first_name, e.student_profiles?.last_initial);
  const collator = (x: string, y: string) => x.localeCompare(y, "es", { sensitivity: "base" });
  const typeCmp = (a: (typeof enriched)[number], b: (typeof enriched)[number]) =>
    a.room_type_id === null ? (b.room_type_id === null ? 0 : 1) : b.room_type_id === null ? -1 : collator(typeName(a), typeName(b));
  // Base: por tipo y, dentro de cada tipo, el orden de prioridad de DR40 (`sortWaitlistEntries`).
  const base = sortWaitlistEntries(filtered).sort(typeCmp);
  const stateRank = (e: (typeof enriched)[number]) => (e.status === "availability_notification_sent" ? 0 : e.status === "retention_check_sent" ? 1 : isWaitingConfirmed(e) ? 2 : 3);
  const sign = filter.dir === "desc" ? -1 : 1;
  const list = filter.orden
    ? [...base].sort((a, b) => {
        switch (filter.orden as SortKey) {
          case "persona":
            return sign * collator(shownName(a), shownName(b));
          case "tipo":
            return sign * typeCmp(a, b);
          case "ingreso": {
            const am = toMonthStart(a.desired_start_date);
            const bm = toMonthStart(b.desired_start_date);
            if (am === null || bm === null) return am === bm ? 0 : am === null ? 1 : -1;
            return sign * am.localeCompare(bm);
          }
          case "espera":
            return sign * (a.waitingDays - b.waitingDays);
          case "estado":
            return sign * (stateRank(a) - stateRank(b));
        }
      })
    : base;
  const selectableIds = list.filter((e) => (NOTIFIABLE_STATUSES as readonly string[]).includes(e.status)).map((e) => e.id);

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
    if (next.orden) {
      qs.set("orden", next.orden);
      if (next.dir === "desc") qs.set("dir", "desc");
    }
    const s = qs.toString();
    return `/residence/${residenceId}/waitlist${s ? `?${s}` : ""}`;
  };
  // asc → desc → orden original.
  const sortHref = (key: SortKey) =>
    filter.orden !== key ? href({ orden: key, dir: "asc" }) : filter.dir === "asc" ? href({ orden: key, dir: "desc" }) : href({ orden: "", dir: "asc" });
  const filtersActive = filter.q !== "" || filter.mes !== "all" || filter.estado !== "all";
  const pillBase = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold sm:min-h-10";

  // Métricas = filtros: cada número es lo que se ve al elegir ese estado, con la búsqueda y el mes actuales.
  const countFor = (patch: Partial<typeof filter>) => filterBoardEntries(enriched, { ...filter, ...patch }, now).length;
  const tabs: { label: string; icon: string; count: number; on: boolean; to: string; warm?: boolean }[] = [
    ...STATE_CHIPS.map((c) => ({
      label: c.label,
      icon: c.value === "all" ? "groups" : c.value === "en-espera" ? "hourglass_top" : c.value === "avisados" ? "mark_email_read" : "check_circle",
      count: countFor({ estado: c.value }),
      on: filter.estado === c.value,
      to: href({ estado: c.value }),
    })),
    {
      label: "Entran este mes",
      icon: "priority_high",
      count: countFor({ mes: "este-mes" }),
      on: filter.mes === "este-mes",
      to: href({ mes: filter.mes === "este-mes" ? "all" : "este-mes" }),
      warm: true,
    },
  ];

  return (
    <div className="tone-residence mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 sm:py-10">
      <header className="relative mb-5 overflow-hidden rounded-card bg-(--tone-soft) px-5 py-5 md:px-8 md:py-6">
        <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-[70px] size-[220px] rounded-full bg-(--tone) opacity-[0.12]" />
        <div className="relative grid gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-(--tone-700)">
            <Icon name="hourglass_top" className="text-lg" />
            Lista de espera
          </span>
          <h1 className="font-display text-[1.75rem] font-bold leading-[1.08] text-(--tone-ink) md:text-4xl">Lista de espera</h1>
          <p className="max-w-[60ch] text-[15px] text-ink-soft">Elegí a varias personas y avisales que hay lugar de una vez.</p>
        </div>
      </header>

      {totalCount === 0 ? (
        <div className="mt-6">
          <EmptyState tone="residence" icon="hourglass_top" title="Nadie en lista de espera" description="Cuando alguien se sume, va a aparecer acá." />
        </div>
      ) : (
        <div className="rounded-card border-[1.5px] border-line bg-paper p-3 shadow-card">
          <nav aria-label="Filtrar por estado" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5">
            {tabs.map((t) => {
              const warm = !t.on && t.warm && t.count > 0;
              return (
                <Link
                  key={t.label}
                  href={t.to}
                  aria-current={t.on ? "true" : undefined}
                  className={`flex min-h-[64px] min-w-[120px] flex-1 flex-col justify-between rounded-field border-[1.5px] px-3 py-2 text-left transition duration-200 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
                    t.on ? "border-(--tone) bg-(--tone) text-white" : warm ? "border-danger-fg/30 bg-paper hover:bg-cream-2" : "border-line-2 bg-paper hover:bg-cream-2"
                  }`}
                >
                  <span className={`flex items-center gap-1 text-[11px] font-bold uppercase leading-tight tracking-[0.04em] ${t.on ? "text-white/90" : "text-ink-faint"}`}>
                    <Icon name={t.icon} className={`shrink-0 text-base ${t.on ? "text-white" : "text-(--tone)"}`} />
                    {t.label}
                  </span>
                  <span className={`font-display text-2xl font-bold leading-none tabular-nums ${t.on ? "text-white" : warm ? "text-danger-fg" : "text-(--tone-ink)"}`}>{t.count}</span>
                </Link>
              );
            })}
          </nav>
          {/* Búsqueda y mes: viajan en la URL, se resuelven en el servidor. */}
          <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Buscar por nombre</span>
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-ink-faint" />
              <input
                type="search"
                name="q"
                defaultValue={filter.q}
                placeholder="Buscar por nombre"
                className="min-h-11 w-full rounded-field border-[1.5px] border-field-border bg-cream pl-10 pr-4 text-sm text-ink focus:border-forest sm:min-h-10"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <span>Ingreso</span>
              <select
                name="mes"
                defaultValue={filter.mes}
                className="min-h-11 rounded-field border-[1.5px] border-field-border bg-cream px-3 text-sm text-ink focus:border-forest sm:min-h-10"
              >
                <option value="all">Todos los meses</option>
                <option value="este-mes">Este mes</option>
                <option value="cuando-haya-lugar">Cuando haya lugar</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatDesiredMonth(m)}
                  </option>
                ))}
              </select>
            </label>
            {filter.estado !== "all" && <input type="hidden" name="estado" value={filter.estado} />}
            {filter.orden && <input type="hidden" name="orden" value={filter.orden} />}
            {filter.orden && filter.dir === "desc" && <input type="hidden" name="dir" value="desc" />}
            <button type="submit" className={`${pillBase} bg-forest-tint text-forest-700 hover:bg-mint`}>
              Filtrar
            </button>
            {filtersActive && (
              <Link href={`/residence/${residenceId}/waitlist`} className={`${pillBase} text-ink-soft hover:bg-cream-2`}>
                Limpiar filtros
              </Link>
            )}
          </form>
          {!canManage && <PermissionNote />}
        </div>
      )}

      {totalCount > 0 &&
        (list.length === 0 ? (
          <div className="mt-5">
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
          </div>
        ) : (
          <WaitlistSelectionProvider residenceId={residenceId} canManage={canManage}>
            <div className="mt-5 overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
              <ScrollTable label="Lista de espera">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-cream-2">
                    <tr>
                      <th scope="col" className="w-12 px-3 py-1.5">
                        <SelectAllCheckbox entryIds={selectableIds} />
                      </th>
                      {COLUMNS.map((c) => {
                        const active = filter.orden === c.key;
                        return (
                          <th key={c.key} scope="col" aria-sort={active ? (filter.dir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-1.5">
                            <Link
                              href={sortHref(c.key)}
                              scroll={false}
                              className={`-mx-2 inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-field px-2 text-xs font-bold uppercase tracking-wider hover:bg-line/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-(--tone) ${active ? "text-(--tone-700)" : "text-muted"}`}
                            >
                              {c.label}
                              <Icon name={active ? (filter.dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} className={`text-base ${active ? "" : "opacity-50"}`} />
                            </Link>
                          </th>
                        );
                      })}
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} typeLabel={typeName(entry)} moving={movingEntryIds.has(entry.id)} residenceId={residenceId} canManage={canManage} nowIso={nowIso} />
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            </div>
          </WaitlistSelectionProvider>
        ))}
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
  typeLabel,
  moving,
  residenceId,
  canManage,
  nowIso,
}: {
  entry: RowEntry;
  typeLabel: string;
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
    <tr id={`entrada-${entry.id}`} className={`border-b border-line align-middle ${entry.thisMonth ? "bg-danger-bg/30" : isNotified ? "bg-orange-tint/40" : ""}`}>
      <td className="px-3 py-2">
        {selectable ? <EntryCheckbox entryId={entry.id} label={name} /> : <span aria-hidden className="block h-11 w-11" />}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <p className="whitespace-nowrap font-bold text-ink">{name}</p>
          {entry.thisMonth && (
            <Badge tone="danger">
              <Icon name="priority_high" className="text-xs" />
              Este mes
            </Badge>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-ink-soft">{typeLabel}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className="font-semibold text-ink">{entry.monthLabel ?? "Cuando haya lugar"}</span>
        {entry.desired_duration_months && <span className="block text-xs text-ink-faint">{entry.desired_duration_months} meses</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-ink-soft">
        {entry.waitingDays} {entry.waitingDays === 1 ? "día" : "días"}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {isNotified && (
            <Badge tone="amber">
              <Icon name="mark_email_read" className="text-xs" />
              {entry.notified_at ? `Avisado ${notifiedDays === 0 ? "hoy" : `hace ${notifiedDays} ${notifiedDays === 1 ? "día" : "días"}`}` : "Avisado"}
            </Badge>
          )}
          {isWaitingConfirmed(entry) && (
            <Badge tone="sage">
              <Icon name="check_circle" className="text-xs" />
              Decidió esperar · {formatDate(entry.waiting_confirmed_at!)}
            </Badge>
          )}
          {entry.status === "active" && !isWaitingConfirmed(entry) && <Badge tone="neutral">En espera</Badge>}
          {entry.status === "retention_check_sent" && <Badge tone="amber">Chequeo de 90 días</Badge>}
          {moving && (
            <Badge tone="amber">
              <Icon name="swap_horiz" className="text-xs" />
              {MOVING_SIGNAL_LABEL}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {canManage ? <WaitlistRowActions residenceId={residenceId} entryId={entry.id} canNotify={selectable} /> : null}
      </td>
    </tr>
  );
}
