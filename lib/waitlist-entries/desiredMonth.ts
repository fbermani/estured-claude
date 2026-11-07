/**
 * Mes de ingreso de la lista de espera (DR40, docs/00 §31, 2026-11-07).
 *
 * El estudiante elige UN MES (no una fecha) o «Cuando haya lugar» (sin mes). Sin cambiar columnas:
 * `desired_start_date` guarda el día 1 del mes ("YYYY-MM-01"); `null` = «Cuando haya lugar».
 * El mes vence cuando termina su último día en hora de Buenos Aires (UTC-3, sin horario de verano).
 *
 * Todo opera sobre strings/UTC, nunca `new Date("YYYY-MM-DD")` con huso local. Sin `server-only`: lo usan
 * componentes cliente (selector del formulario), páginas y tests.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const WAITLIST_MONTHS_AHEAD = 12;
/** Valor del selector para «Cuando haya lugar» (el servidor lo traduce a `null`). */
export const WAITLIST_ANY_MONTH_VALUE = "any";
/** `removed_reason` de las entradas que vencen por mes. */
export const WAITLIST_MONTH_PASSED_REASON = "month_passed";

/** Año y mes (1–12) de una fecha date-only, o `null` si no tiene forma válida. */
function parseYearMonth(value: string | null | undefined): { year: number; month: number } | null {
  if (!value) return null;
  const m = DATE_ONLY.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoy en Buenos Aires como { year, month, day }. */
function todayBa(now: Date): { year: number; month: number; day: number } {
  const ba = new Date(now.getTime() - 3 * 3600 * 1000);
  return { year: ba.getUTCFullYear(), month: ba.getUTCMonth() + 1, day: ba.getUTCDate() };
}

/** Normaliza cualquier fecha date-only al día 1 de su mes ("2026-11-17" → "2026-11-01"). `null` si es inválida. */
export function toMonthStart(value: string | null | undefined): string | null {
  const ym = parseYearMonth(value);
  return ym ? `${ym.year}-${pad(ym.month)}-01` : null;
}

/** Primer día del mes en curso (Buenos Aires). */
export function currentMonthStart(now: Date = new Date()): string {
  const t = todayBa(now);
  return `${t.year}-${pad(t.month)}-01`;
}

/** Último día del mes ("2026-11-01" → "2026-11-30"). `null` si es inválida. Sirve para la validación de superposición. */
export function monthEndIso(value: string | null | undefined): string | null {
  const ym = parseYearMonth(value);
  if (!ym) return null;
  const last = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
  return `${ym.year}-${pad(ym.month)}-${pad(last)}`;
}

/** «noviembre 2026». `null` si no hay mes válido. */
export function formatDesiredMonth(value: string | null | undefined): string | null {
  const ym = parseYearMonth(value);
  return ym ? `${MONTH_NAMES[ym.month - 1]} ${ym.year}` : null;
}

/** Índice absoluto de meses (año*12 + mes-1), para comparar y restar. */
function monthIndex(ym: { year: number; month: number }): number {
  return ym.year * 12 + ym.month - 1;
}

/**
 * ¿Ya terminó el mes elegido? Verdadero desde el día 1 del mes siguiente (00:00 Buenos Aires).
 * Sin mes (`null`) o fecha inválida: nunca vence por fecha.
 */
export function isDesiredMonthExpired(value: string | null | undefined, now: Date = new Date()): boolean {
  const ym = parseYearMonth(value);
  if (!ym) return false;
  const t = todayBa(now);
  return monthIndex(ym) < monthIndex(t);
}

/** Meses desde el actual hasta el mes elegido (0 = este mes, negativo = ya terminó). `null` sin mes válido. */
export function monthsUntilDesired(value: string | null | undefined, now: Date = new Date()): number | null {
  const ym = parseYearMonth(value);
  if (!ym) return null;
  return monthIndex(ym) - monthIndex(todayBa(now));
}

/** ¿El mes elegido es el mes en curso? (urgente: la persona quiere entrar ya). */
export function isCurrentMonth(value: string | null | undefined, now: Date = new Date()): boolean {
  return monthsUntilDesired(value, now) === 0;
}

export type MonthOption = { value: string; label: string };

/**
 * Opciones del selector: del mes actual a +12 meses (13 opciones). Con `minStartDate` (reserva vigente), solo meses desde el mes de
 * esa fecha (aunque sea posterior a +12: el selector se extiende 12 meses desde el mayor entre hoy y la fecha mínima).
 */
export function buildMonthOptions(now: Date = new Date(), minStartDate?: string | null): MonthOption[] {
  const today = todayBa(now);
  const min = parseYearMonth(minStartDate);
  const startIdx = Math.max(monthIndex(today), min ? monthIndex(min) : 0);
  const options: MonthOption[] = [];
  for (let i = 0; i <= WAITLIST_MONTHS_AHEAD; i += 1) {
    const idx = startIdx + i;
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    options.push({ value: `${year}-${pad(month)}-01`, label: `${MONTH_NAMES[month - 1]} ${year}` });
  }
  return options;
}

export type ParsedDesiredMonth = { ok: true; desiredStartDate: string | null } | { ok: false; error: string };

/**
 * Valida server-side lo que llega del formulario: «any» → sin mes; un "YYYY-MM-DD" → su día 1, que no sea de un mes pasado ni
 * anterior al mes de `minStartDate`. Vacío / basura → error (hay que elegir una de las dos opciones).
 */
export function parseDesiredMonthInput(
  raw: string | null | undefined,
  options: { now?: Date; minStartDate?: string | null } = {},
): ParsedDesiredMonth {
  const now = options.now ?? new Date();
  const value = (raw ?? "").trim();
  if (value === WAITLIST_ANY_MONTH_VALUE) return { ok: true, desiredStartDate: null };
  const monthStart = toMonthStart(value);
  if (!monthStart) return { ok: false, error: "Elegí un mes de ingreso o «Cuando haya lugar»." };
  if (isDesiredMonthExpired(monthStart, now)) return { ok: false, error: "Ese mes ya pasó. Elegí otro mes o «Cuando haya lugar»." };
  const minMonth = toMonthStart(options.minStartDate);
  if (minMonth && monthStart < minMonth) {
    return { ok: false, error: "Ese mes cae dentro de tu reserva actual. Elegí un mes posterior." };
  }
  return { ok: true, desiredStartDate: monthStart };
}

/**
 * ¿Cuenta como entrada vigente de la lista? Excluye `active` / `retention_check_sent` con mes ya terminado (aunque el cron todavía no
 * las venza). `availability_notification_sent` (a mitad de flujo) y las sin mes siempre cuentan.
 */
export function isCountableWaitlistEntry(
  entry: { status: string; desired_start_date: string | null },
  now: Date = new Date(),
): boolean {
  if (entry.status === "availability_notification_sent") return true;
  if (entry.status !== "active" && entry.status !== "retention_check_sent") return false;
  return !isDesiredMonthExpired(entry.desired_start_date, now);
}

export type WaitlistSortable = {
  status: string;
  desired_start_date: string | null;
  joined_at: string;
};

const NEEDS_RESPONSE = new Set(["availability_notification_sent", "retention_check_sent"]);

/**
 * Orden de la lista de la residencia dentro de un grupo (DR40): (a) con respuesta corriendo primero; (b) mes elegido ascendente;
 * (c) antigüedad (`joined_at` ascendente, FIFO); (d) sin mes («Cuando haya lugar») al final, también FIFO.
 * Devuelve una copia ordenada; no muta la entrada.
 */
export function sortWaitlistEntries<T extends WaitlistSortable>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const aResp = NEEDS_RESPONSE.has(a.status);
    const bResp = NEEDS_RESPONSE.has(b.status);
    if (aResp !== bResp) return aResp ? -1 : 1;
    const aMonth = toMonthStart(a.desired_start_date);
    const bMonth = toMonthStart(b.desired_start_date);
    if (aMonth !== bMonth) {
      if (aMonth === null) return 1;
      if (bMonth === null) return -1;
      return aMonth < bMonth ? -1 : 1;
    }
    return a.joined_at < b.joined_at ? -1 : a.joined_at > b.joined_at ? 1 : 0;
  });
}
