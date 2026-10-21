/**
 * Contrato vigente del estudiante: fin de contrato y tarifa (auditoría
 * 2026-10-20, H05). Funciones PURAS — sin Supabase, sin `Date.now()`
 * implícito (el "ahora" se inyecta) — para poder testearlas sin red.
 *
 * Por qué existe: del lado estudiante el fin de contrato se calculaba como
 * `start_date + initial_duration_months`, ignorando renovaciones
 * confirmadas y `resident_stays.expected_end_date`. Una estudiante que
 * renovó y pagó un segundo fee seguía viendo "quedan ~3 meses", y la
 * residencia veía otra fecha. Ahora hay una sola regla (decisión D5 del
 * plan de acción: la tarifa PUEDE diferir del snapshot, con
 * transparencia):
 *
 *   Fin de contrato vigente =
 *     1. `resident_stays.expected_end_date` de la estadía vinculada
 *        (`resident_stays.reservation_id`), si existe; si no,
 *     2. el `period_end_date` más lejano de las renovaciones
 *        `confirmed`/`receipt_issued` de la reserva; si no,
 *     3. `start_date + initial_duration_months` de la reserva.
 *
 *   Tarifa vigente = `resident_stays.monthly_rate_usd` si existe; si no, la
 *   del snapshot aceptado en la reserva. Si la de la estadía difiere de la
 *   del snapshot, la UI muestra la diferencia (nunca se bloquea la edición
 *   de tarifas en Residentes).
 *
 * Las fechas son `date` de Postgres ("YYYY-MM-DD") y se tratan SIEMPRE en
 * UTC: `new Date("2027-01-20")` es medianoche UTC y formatearlo en un huso
 * negativo (Argentina) correría el día mostrado uno para atrás.
 */

export type ContractEndSource = "stay" | "renewal" | "reservation";

export type RenewalPeriod = {
  /** `renewal_offers.status` */
  status: string;
  /** `renewal_offers.period_end_date` ("YYYY-MM-DD") */
  periodEndDate: string | null;
};

export type ContractEnd = {
  /** Fin de contrato vigente, "YYYY-MM-DD". */
  endDate: string;
  source: ContractEndSource;
  /** Fin del contrato original (reserva), "YYYY-MM-DD". */
  originalEndDate: string;
  /** Fecha hasta la que está renovado, o `null` si no hay renovación confirmada que lo extienda. */
  renewedUntil: string | null;
};

/** Estados de `renewal_offers` que cuentan como renovación efectivamente confirmada (docs/04 §12.3). */
export const CONFIRMED_RENEWAL_STATUSES = ["confirmed", "receipt_issued"] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(dateStr: string): { y: number; m: number; d: number } | null {
  const match = DATE_ONLY.exec(dateStr);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Suma meses a una fecha, recortando al último día del mes destino cuando
 * el día no existe (31 ene + 1 mes = 28 feb, no 3 mar). Devuelve ISO.
 */
export function addMonthsIso(dateStr: string, months: number): string {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return dateStr;
  const targetMonthIndex = parsed.m - 1 + months;
  const lastDay = new Date(Date.UTC(parsed.y, targetMonthIndex + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(parsed.y, targetMonthIndex, Math.min(parsed.d, lastDay)));
  return toIso(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

/** "20/1/2027" (es-AR, en UTC). Devuelve "—" si la fecha no es válida. */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return "—";
  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toLocaleDateString("es-AR", { timeZone: "UTC" });
}

/**
 * Días de calendario que faltan hasta `dateStr`, contando "hoy" en
 * America/Argentina/Buenos_Aires (la fecha del contrato es una fecha
 * date-only argentina: comparar contra medianoche UTC mostraba un día de
 * menos entre las 21:00 y las 24:00 locales). Negativo o cero = ya venció.
 * `now` se inyecta para que sea testeable.
 */
export function daysUntilDate(dateStr: string, now: Date = new Date()): number {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return 0;
  const todayAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now);
  const today = parseDateOnly(todayAr);
  if (!today) return 0;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((Date.UTC(parsed.y, parsed.m - 1, parsed.d) - Date.UTC(today.y, today.m - 1, today.d)) / MS_PER_DAY);
}

export function resolveContractEnd(input: {
  /** `reservations.start_date` */
  startDate: string;
  /** `reservations.initial_duration_months` */
  initialDurationMonths: number;
  /** `resident_stays.expected_end_date` de la estadía actual vinculada a la reserva (si existe). */
  stayExpectedEndDate?: string | null;
  /** Renovaciones de la reserva (cualquier estado: se filtran las confirmadas acá). */
  renewals?: RenewalPeriod[];
}): ContractEnd {
  const originalEndDate = addMonthsIso(input.startDate, input.initialDurationMonths);

  let latestRenewalEnd: string | null = null;
  for (const r of input.renewals ?? []) {
    if (!(CONFIRMED_RENEWAL_STATUSES as readonly string[]).includes(r.status)) continue;
    if (!r.periodEndDate || !parseDateOnly(r.periodEndDate)) continue;
    // "YYYY-MM-DD" ordena bien como string.
    if (!latestRenewalEnd || r.periodEndDate > latestRenewalEnd) latestRenewalEnd = r.periodEndDate;
  }

  let endDate = originalEndDate;
  let source: ContractEndSource = "reservation";
  if (input.stayExpectedEndDate && parseDateOnly(input.stayExpectedEndDate)) {
    endDate = input.stayExpectedEndDate;
    source = "stay";
  } else if (latestRenewalEnd) {
    endDate = latestRenewalEnd;
    source = "renewal";
  }

  // "Renovada hasta…" solo si hay una renovación confirmada Y el contrato
  // vigente efectivamente termina después del original.
  const renewedUntil = latestRenewalEnd && endDate > originalEndDate ? endDate : null;

  return { endDate, source, originalEndDate, renewedUntil };
}

export type StayRate = {
  /** Tarifa vigente: la de la estadía si existe; si no, la del snapshot. */
  currentRateUsd: number | null;
  /** Tarifa acordada en la reserva (snapshot aceptado). */
  agreedRateUsd: number | null;
  /** `true` si la estadía tiene una tarifa propia distinta de la acordada. */
  differs: boolean;
};

function sameAmount(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export function resolveStayRate(input: {
  /** `application_snapshots.monthly_price_usd` de la reserva */
  snapshotRateUsd: number | null | undefined;
  /** `resident_stays.monthly_rate_usd` de la estadía vinculada */
  stayRateUsd: number | null | undefined;
}): StayRate {
  const agreed = input.snapshotRateUsd != null ? Number(input.snapshotRateUsd) : null;
  const stay = input.stayRateUsd != null ? Number(input.stayRateUsd) : null;
  const current = stay ?? agreed;
  const differs = stay !== null && agreed !== null && !sameAmount(stay, agreed);
  return { currentRateUsd: current, agreedRateUsd: agreed, differs };
}
