import { todayIso } from "@/lib/applications/reservationMoney";

/**
 * Cálculo de "meses vacíos" (referencia de configuración, migración
 * 0025): meses calendario COMPLETOS entre la solicitud y la fecha de
 * ingreso, con tope de 3 (la referencia: "al reservar un cupo futuro
 * (máximo 3 meses)"). La residencia cobra `empty_month_charge_percent`
 * % de la renta por cada uno. Archivo sin "server-only" a propósito:
 * lo usan la previa del cliente (ApplyForm) y el snapshot del server.
 */
export const MAX_EMPTY_MONTHS = 3;

export function computeEmptyMonths(desiredStartDate: string, from: Date = dateFromIso(todayIso())): number {
  const [y, m] = desiredStartDate.split("-").map(Number);
  if (!y || !m) return 0;
  const raw = (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()) - 1;
  return Math.min(MAX_EMPTY_MONTHS, Math.max(0, raw));
}

export function emptyMonthsChargeUsd(params: {
  desiredStartDate: string;
  monthlyPriceUsd: number;
  chargePercent: number | null;
  from?: Date;
}): { months: number; chargeUsd: number } {
  const months = computeEmptyMonths(params.desiredStartDate, params.from);
  if (params.chargePercent == null || params.chargePercent <= 0 || months === 0) {
    return { months, chargeUsd: 0 };
  }
  return { months, chargeUsd: months * params.monthlyPriceUsd * (params.chargePercent / 100) };
}

/** "YYYY-MM-DD" → Date local a medianoche (solo para el cálculo de meses calendario). */
function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const monthKey = (y: number, monthIndex: number) => {
  const yy = y + Math.floor(monthIndex / 12);
  const mm = ((monthIndex % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
};

/** Claves "YYYY-MM" de los meses completos entre hoy y el ingreso (los candidatos a «mes vacío», tope `MAX_EMPTY_MONTHS`). */
export function candidateMonthKeys(desiredStartDate: string, today: string): string[] {
  const n = computeEmptyMonths(desiredStartDate, dateFromIso(today));
  const [ty, tm] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => monthKey(ty, tm - 1 + i + 1));
}

/**
 * MES VACÍO CONFIRMADO (corrección del dueño, `docs/00` «DR18 fase 2, tanda 3: correcciones»). Se cobra SOLO si (1) la reserva es
 * diferida (hay meses completos entre hoy y el ingreso) y (2) el tipo de habitación realmente no tiene ocupación en esos meses.
 * El dato de ocupación (`VacancyOutlook`) lo arma el servidor con estadías y reservas reales; sin dato confiable no se cobra y el
 * estado queda `to_confirm` («a confirmar por la residencia»). El cliente nunca manda el monto.
 */
export type VacancyOutlook = {
  /** `false` = no hay ocupación futura confiable (residencia sin Gestión Operativa, sin capacidad o sin estadías cargadas). */
  reliable: boolean;
  /** Meses "YYYY-MM" (de los próximos `MAX_EMPTY_MONTHS`) en los que el tipo tiene menos plazas ocupadas que su capacidad. */
  emptyMonthKeys: string[];
};

export type EmptyMonthsStatus = "none" | "charged" | "not_charged" | "to_confirm";

export type ConfirmedEmptyMonths = {
  status: EmptyMonthsStatus;
  /** Meses completos entre hoy y el ingreso (candidatos, tope 3). */
  candidateMonths: number;
  /** Meses efectivamente vacíos y cobrables (0 si no se cobra o está a confirmar). */
  months: number;
  chargeUsd: number;
};

export function confirmedEmptyMonthsCharge(params: {
  desiredStartDate: string;
  monthlyPriceUsd: number;
  chargePercent: number | null;
  vacancy: VacancyOutlook | null;
  today: string;
}): ConfirmedEmptyMonths {
  const candidates = params.desiredStartDate ? candidateMonthKeys(params.desiredStartDate, params.today) : [];
  const none = { status: "none" as const, candidateMonths: candidates.length, months: 0, chargeUsd: 0 };
  if (candidates.length === 0 || params.chargePercent == null || params.chargePercent <= 0) return none;
  if (!params.vacancy || !params.vacancy.reliable) {
    return { status: "to_confirm", candidateMonths: candidates.length, months: 0, chargeUsd: 0 };
  }
  const empty = new Set(params.vacancy.emptyMonthKeys);
  const months = candidates.filter((k) => empty.has(k)).length;
  if (months === 0) return { status: "not_charged", candidateMonths: candidates.length, months: 0, chargeUsd: 0 };
  const chargeUsd = Math.round(months * params.monthlyPriceUsd * (params.chargePercent / 100) * 100) / 100;
  return { status: "charged", candidateMonths: candidates.length, months, chargeUsd };
}

const lastDayOf = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${key}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/** start + N meses (exclusivo) como "YYYY-MM-DD". */
function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Ocupación futura de un tipo de habitación, mes a mes, para los próximos `MAX_EMPTY_MONTHS` meses (sin el actual). Un mes está vacío
 * si las plazas ocupadas son menos que la capacidad. Ocupan: estadías vigentes (sin fecha de fin = ocupan siempre, ante la duda) y
 * reservas en curso del tipo que todavía no tienen estadía vinculada (de su inicio a inicio + duración).
 */
export function buildVacancyOutlook(params: {
  today: string;
  /** Plazas declaradas del tipo (habitaciones activas × capacidad por habitación). */
  capacity: number;
  /** Solo con Gestión Operativa (Premium): único dato de ocupación confiable. */
  premium: boolean;
  /** Estadías vigentes del tipo. */
  stays: { startDate: string | null; endDate: string | null }[];
  /** Una reserva sin inicio o con duración inválida no se puede ubicar en el tiempo: el tipo deja de ser confiable (no se cobra). */
  reservations: { startDate: string | null; durationMonths: number | null }[];
  /** Hay alguna estadía vigente de la residencia (aunque sea de otro tipo): sin ninguna cargada, la ocupación no es confiable. */
  residenceHasStays: boolean;
}): VacancyOutlook {
  const validReservations = params.reservations.every(
    (r) =>
      !!r.startDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.startDate) &&
      r.durationMonths != null &&
      Number.isFinite(r.durationMonths) &&
      r.durationMonths > 0,
  );
  const reliable = params.premium && params.capacity > 0 && params.residenceHasStays && validReservations;
  if (!reliable) return { reliable: false, emptyMonthKeys: [] };
  const [ty, tm] = params.today.split("-").map(Number);
  const keys = Array.from({ length: MAX_EMPTY_MONTHS }, (_, i) => monthKey(ty, tm - 1 + i + 1));
  const emptyMonthKeys = keys.filter((key) => {
    const mStart = `${key}-01`;
    const mEnd = lastDayOf(key);
    const staysIn = params.stays.filter((st) => (!st.startDate || st.startDate <= mEnd) && (!st.endDate || st.endDate >= mStart)).length;
    const reservedIn = params.reservations.filter(
      (r) => (r.startDate as string) <= mEnd && addMonthsIso(r.startDate as string, r.durationMonths as number) > mStart,
    ).length;
    return staysIn + reservedIn < params.capacity;
  });
  return { reliable: true, emptyMonthKeys };
}
