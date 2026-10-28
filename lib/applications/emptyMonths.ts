/**
 * MES VACÍO (docs/00 «DR18 fase 2, tanda 3: segunda corrección del mes vacío», migración 0062). Archivo sin "server-only" a propósito:
 * lo usan la previa del cliente (`CostBreakdown`) y el servidor (snapshot, negociación) con el MISMO cálculo; el cliente nunca manda el monto.
 *
 * Regla: si el tipo tiene disponibilidad publicada, la plaza está vacante desde `max(hoy, available_from)`; la ocupación real
 * (estadías y reservas, Premium) solo descarta tramos ocupados. La reserva es diferida si el ingreso es posterior al inicio de la
 * vacancia. El tramo vacío = desde el inicio de la vacancia hasta el día anterior al ingreso, medido en meses completos (1 c/u) más el
 * resto en días (más de 15 días = 1 mes; 1 a 15 días = 0,5). Tope `MAX_EMPTY_MONTHS`. Sin disponibilidad publicada: «a confirmar».
 */
export const MAX_EMPTY_MONTHS = 3;
/** Días de ocupación futura que se evalúan; un ingreso más lejano queda «a confirmar» (no se estima). */
export const VACANCY_HORIZON_DAYS = 400;
/** Con más de estos días sobrantes el resto cuenta como un mes entero; con 15 o menos, medio mes. */
export const PARTIAL_MONTH_THRESHOLD_DAYS = 15;

/** Ocupación/vacancia de un tipo de habitación, independiente de la fecha de ingreso (así la previa del cliente puede recalcular). */
export type VacancyOutlook = {
  /** Disponibilidad publicada del tipo (`available_to_confirm`, no oculta): día desde el que la plaza está vacante (`available_from` o hoy). null = no publicada. */
  availableFrom: string | null;
  /** Hay ocupación real confiable (Premium con capacidad y estadías cargadas). */
  hasOccupancyData: boolean;
  /** Rangos "YYYY-MM-DD" (inclusive) en los que el tipo está completo, dentro del horizonte. Vacío sin ocupación real. */
  fullRanges: { from: string; to: string }[];
  /** Último día evaluado de ocupación; un ingreso posterior queda «a confirmar». null sin ocupación real. */
  horizonEnd: string | null;
};

export type EmptyMonthsStatus = "none" | "charged" | "not_charged" | "to_confirm";

export type ConfirmedEmptyMonths = {
  status: EmptyMonthsStatus;
  /** Unidades de mes cobradas (0,5 / 1 / 1,5 … hasta `MAX_EMPTY_MONTHS`); 0 si no se cobra. */
  months: number;
  /** Primer día de la vacancia que se mide (null si no hay tramo). */
  vacantFrom: string | null;
  chargeUsd: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;
const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);

/** a + n meses, con el día ajustado al fin de mes si no existe (31/1 + 1 mes = 28/2). */
function addMonthsClamped(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(y, m - 1 + n, Math.min(d, lastDay)));
}

/**
 * Unidades de mes de un tramo [from, to): meses completos + parcial (>15 días = 1; 1 a 15 = 0,5). 0 si el tramo es vacío.
 * Criterio: el mes N se ancla SIEMPRE en el día de `from` con el día ajustado al fin del mes de destino (no se encadena): 31/1 + 1 mes =
 * 28/2 (29/2 en bisiesto), 31/1 + 2 meses = 31/3. Un mes está completo si su ancla es menor o igual a `to`; el resto son los días entre
 * la última ancla completa y `to`.
 */
export function measureVacantSpan(from: string, to: string): number {
  if (to <= from) return 0;
  let full = 0;
  while (addMonthsClamped(from, full + 1) <= to) full++;
  const rest = daysBetween(addMonthsClamped(from, full), to);
  const partial = rest > PARTIAL_MONTH_THRESHOLD_DAYS ? 1 : rest > 0 ? 0.5 : 0;
  return full + partial;
}

export function confirmedEmptyMonthsCharge(params: {
  desiredStartDate: string;
  monthlyPriceUsd: number;
  chargePercent: number | null;
  vacancy: VacancyOutlook | null;
  today: string;
}): ConfirmedEmptyMonths {
  const { desiredStartDate: start, today, vacancy } = params;
  const none: ConfirmedEmptyMonths = { status: "none", months: 0, vacantFrom: null, chargeUsd: 0 };
  if (params.chargePercent == null || params.chargePercent <= 0) return none;
  if (!ISO.test(start) || start <= today) return none;
  // Sin disponibilidad publicada (o sin lectura) no se estima: «a confirmar por la residencia».
  if (!vacancy || !vacancy.availableFrom) return { ...none, status: "to_confirm" };
  // Ocupación real más allá del horizonte evaluado: no se estima.
  if (vacancy.hasOccupancyData && vacancy.horizonEnd && start > addDays(vacancy.horizonEnd, 1)) return { ...none, status: "to_confirm" };

  // La regla del dueño es la vacancia PREVIA AL INGRESO: se mide solo el tramo libre inmediatamente anterior al ingreso, desde el último día
  // completo antes del ingreso (o desde que la plaza está disponible). Un tramo libre anterior que después se ocupó NO se suma.
  let vacantFrom = vacancy.availableFrom > today ? vacancy.availableFrom : today;
  if (vacancy.hasOccupancyData) {
    const lastDayBeforeStart = addDays(start, -1);
    for (const r of vacancy.fullRanges) {
      if (r.from > lastDayBeforeStart) continue;
      // Completa hasta el ingreso (o más allá): no hay tramo vacío antes de ingresar.
      const lastFullDay = r.to < lastDayBeforeStart ? r.to : lastDayBeforeStart;
      if (addDays(lastFullDay, 1) > vacantFrom) vacantFrom = addDays(lastFullDay, 1);
    }
  }
  // Ingreso en el primer día disponible (o antes): no hay tramo vacío.
  if (vacantFrom >= start) return { status: "not_charged", months: 0, vacantFrom: null, chargeUsd: 0 };
  const units = Math.min(MAX_EMPTY_MONTHS, measureVacantSpan(vacantFrom, start));
  if (units <= 0) return { status: "not_charged", months: 0, vacantFrom: null, chargeUsd: 0 };
  const chargeUsd = Math.round(units * params.monthlyPriceUsd * (params.chargePercent / 100) * 100) / 100;
  return { status: "charged", months: units, vacantFrom, chargeUsd };
}

/**
 * Arma el `VacancyOutlook` de un tipo. La disponibilidad publicada (`availableFrom`) la decide quien llama; la ocupación real solo cuenta
 * con Premium, capacidad > 0, al menos una estadía cargada en la residencia y reservas con fechas válidas (si no, `hasOccupancyData` = false).
 * Ocupan: estadías vigentes (sin fecha de fin = siempre) y reservas vigentes sin estadía vinculada (inicio → inicio + duración). Un día está
 * «completo» si las plazas ocupadas alcanzan la capacidad.
 */
export function buildVacancyOutlook(params: {
  today: string;
  availableFrom: string | null;
  capacity: number;
  premium: boolean;
  stays: { startDate: string | null; endDate: string | null }[];
  /** Una reserva sin inicio o con duración inválida no se puede ubicar en el tiempo: se descarta la ocupación real (no se asume libre). */
  reservations: { startDate: string | null; durationMonths: number | null }[];
  residenceHasStays: boolean;
}): VacancyOutlook {
  const validReservations = params.reservations.every(
    (r) => !!r.startDate && ISO.test(r.startDate) && r.durationMonths != null && Number.isFinite(r.durationMonths) && r.durationMonths > 0,
  );
  const hasOccupancyData = params.premium && params.capacity > 0 && params.residenceHasStays && validReservations;
  if (!hasOccupancyData) return { availableFrom: params.availableFrom, hasOccupancyData: false, fullRanges: [], horizonEnd: null };

  const horizonEnd = addDays(params.today, VACANCY_HORIZON_DAYS);
  const intervals: [string, string][] = [
    ...params.stays.map((s) => [s.startDate ?? "0000-01-01", s.endDate ?? "9999-12-31"] as [string, string]),
    ...params.reservations.map(
      (r) => [r.startDate as string, addDays(addMonthsClamped(r.startDate as string, r.durationMonths as number), -1)] as [string, string],
    ),
  ];
  const fullRanges: { from: string; to: string }[] = [];
  let open: { from: string; to: string } | null = null;
  for (let d = params.today, i = 0; i <= VACANCY_HORIZON_DAYS; i++, d = addDays(d, 1)) {
    const occupied = intervals.filter(([a, b]) => a <= d && d <= b).length;
    if (occupied >= params.capacity) {
      if (open) open.to = d;
      else open = { from: d, to: d };
    } else if (open) {
      fullRanges.push(open);
      open = null;
    }
  }
  if (open) fullRanges.push(open);
  return { availableFrom: params.availableFrom, hasOccupancyData: true, fullRanges, horizonEnd };
}
