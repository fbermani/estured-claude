import { formatShortName } from "@/lib/format/shortName";
import { isCurrentMonth, isDesiredMonthExpired, toMonthStart } from "@/lib/waitlist-entries/desiredMonth";

/** Tope de entradas por lote de avisos (DR41). */
export const MAX_NOTIFY_BATCH = 50;

/** Estados que la residencia puede avisar («hay lugar»): `active` o ya con chequeo de retención (DR41). */
export const NOTIFIABLE_STATUSES = ["active", "retention_check_sent"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BatchEntry = { id: string; status: string; desired_start_date: string | null };
export type BatchSkip = { entryId: string; reason: string };

export type BatchPlan = {
  /** Ids válidos, sin duplicados. */
  ids: string[];
  eligible: BatchEntry[];
  skipped: BatchSkip[];
};

export type BatchPlanResult = { ok: true; plan: BatchPlan } | { ok: false; error: string };

/**
 * Decide qué entradas de un lote se avisan y cuáles se ignoran (con motivo). Pura: no toca la base.
 * `found` son las filas leídas de la residencia; lo pedido que no aparece se ignora como inexistente.
 */
export function planNotifyBatch(requestedIds: unknown, found: BatchEntry[], now: Date = new Date()): BatchPlanResult {
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    return { ok: false, error: "Elegí al menos una persona de la lista." };
  }
  const ids = Array.from(new Set(requestedIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id))));
  if (ids.length === 0) return { ok: false, error: "No pudimos leer la selección. Actualizá la página e intentá de nuevo." };
  if (ids.length > MAX_NOTIFY_BATCH) {
    return { ok: false, error: `Podés avisar a ${MAX_NOTIFY_BATCH} personas por vez como máximo. Elegiste ${ids.length}.` };
  }

  const byId = new Map(found.map((e) => [e.id, e]));
  const eligible: BatchEntry[] = [];
  const skipped: BatchSkip[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) {
      skipped.push({ entryId: id, reason: "No encontramos esa entrada en esta lista." });
    } else if (entry.status === "availability_notification_sent") {
      skipped.push({ entryId: id, reason: "Ya la avisaste y está esperando respuesta." });
    } else if (!(NOTIFIABLE_STATUSES as readonly string[]).includes(entry.status)) {
      skipped.push({ entryId: id, reason: "Esta entrada ya no está en la lista." });
    } else if (isDesiredMonthExpired(entry.desired_start_date, now)) {
      skipped.push({ entryId: id, reason: "El mes de ingreso que eligió ya terminó." });
    } else {
      eligible.push(entry);
    }
  }
  return { ok: true, plan: { ids, eligible, skipped } };
}

/** Texto del resultado parcial de un lote: «Avisamos a 3. No pudimos con 2: …». */
export function describeBatchResult(result: { notified: number; failed: BatchSkip[]; skipped: BatchSkip[]; withoutNotification?: BatchSkip[] }): string {
  const parts: string[] = [];
  parts.push(result.notified > 0 ? `Avisamos a ${result.notified} ${result.notified === 1 ? "persona" : "personas"}.` : "No avisamos a nadie.");
  const problems = [...result.failed, ...result.skipped];
  if (problems.length > 0) {
    const reasons = Array.from(new Set(problems.map((p) => p.reason)));
    parts.push(`No pudimos con ${problems.length}: ${reasons.join(" ")}`);
  }
  const silent = result.withoutNotification ?? [];
  if (silent.length > 0) {
    parts.push(`${silent.length} ${silent.length === 1 ? "quedó avisada" : "quedaron avisadas"} sin notificación: avisales por otro medio.`);
  }
  return parts.join(" ");
}

/** «Decidió esperar»: volvió a `active` después de un aviso y la residencia todavía no lo reavisó. */
export function isWaitingConfirmed(entry: { status: string; waiting_confirmed_at?: string | null }): boolean {
  return entry.status === "active" && Boolean(entry.waiting_confirmed_at);
}

/** Columnas del aviso: al avisar se limpia la marca «Decidió esperar» y se registra cuándo (DR41). */
export function notifiedColumns(nowIso: string): { notified_at: string; waiting_confirmed_at: null } {
  return { notified_at: nowIso, waiting_confirmed_at: null };
}

export type BoardFilter = {
  q: string;
  /** «all» | «este-mes» | «cuando-haya-lugar» | «YYYY-MM-01» */
  mes: string;
  /** «all» | «avisados» | «en-espera» | «decidieron-esperar» */
  estado: string;
};

export type BoardEntry = {
  status: string;
  desired_start_date: string | null;
  waiting_confirmed_at?: string | null;
  student_profiles: { first_name: string; last_initial: string } | null;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Filtros rápidos del tablero (mes / estado / nombre). Un filtro desconocido no filtra. */
export function filterBoardEntries<T extends BoardEntry>(entries: T[], filter: BoardFilter, now: Date = new Date()): T[] {
  const q = normalize(filter.q);
  return entries.filter((e) => {
    if (q) {
      const name = normalize(formatShortName(e.student_profiles?.first_name, e.student_profiles?.last_initial));
      if (!name.includes(q)) return false;
    }
    if (filter.mes === "este-mes" && !isCurrentMonth(e.desired_start_date, now)) return false;
    if (filter.mes === "cuando-haya-lugar" && toMonthStart(e.desired_start_date) !== null) return false;
    if (/^\d{4}-\d{2}-01$/.test(filter.mes) && toMonthStart(e.desired_start_date) !== filter.mes) return false;
    if (filter.estado === "avisados" && e.status !== "availability_notification_sent") return false;
    if (filter.estado === "en-espera" && e.status === "availability_notification_sent") return false;
    if (filter.estado === "decidieron-esperar" && !isWaitingConfirmed(e)) return false;
    return true;
  });
}
