import { buildInitialPayment, type InitialPayment, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";

/**
 * Dinero de una reserva (DR18 fase 2, tanda 3; `docs/00` «DR18 fase 2, tanda 3»): descuento de matrícula, depósito con
 * opciones, promociones de tarifa y pago inicial «solo matrícula». Módulo puro (sin `server-only`): lo usan el server al
 * armar el snapshot (`createApplicationFromRoomType`) y el cliente en la previa (`CostBreakdown`), así no divergen.
 *
 * Principio (decisión 4 del Owner): el fee se calcula sobre lo que paga el estudiante → `monthlyUsd` ya lleva la promoción
 * y `enrollmentUsd` ya lleva el descuento. El depósito y el mes vacío contingente nunca entran a esa base.
 */

export const ENROLLMENT_DISCOUNT_PRESETS = [25, 50, 100] as const;
export const EMPTY_MONTH_PERCENT_PRESETS = [25, 50, 75, 100] as const;
export const PROMOTION_MAX_PERCENT = 90;
export const PROMOTION_LABEL_MIN = 2;
export const PROMOTION_LABEL_MAX = 60;

export type DepositMode = "half_month" | "one_month" | "two_months";

/** Opciones de depósito en meses de renta de lista (el monto fijo en USD es el caso `null`). */
export const DEPOSIT_OPTIONS: { mode: DepositMode; months: number; label: string }[] = [
  { mode: "half_month", months: 0.5, label: "Medio mes de renta" },
  { mode: "one_month", months: 1, label: "1 mes de renta" },
  { mode: "two_months", months: 2, label: "2 meses de renta" },
];

export function normalizeDepositMode(value: unknown): DepositMode | null {
  return value === "half_month" || value === "one_month" || value === "two_months" ? value : null;
}

export function depositModeLabel(mode: DepositMode): string {
  return DEPOSIT_OPTIONS.find((o) => o.mode === mode)?.label ?? "";
}

/** USD con centavos exactos (evita 0.1+0.2 en los montos guardados). */
export function roundCents(usd: number): number {
  return Math.round(usd * 100) / 100;
}

export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * "YYYY-MM-DD" de hoy en la zona de EstuRed (Buenos Aires), igual en servidor y cliente: la vigencia es por día calendario y
 * no depende de la zona del servidor ni del navegador (evita desfases de hidratación). Sin APIs de node.
 */
export function todayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Vigencia por fechas "YYYY-MM-DD" (comparables como texto): inicio y fin inclusivos; sin fin = sin vencimiento. */
export function isWithinWindow(window: { startsOn?: string | null; endsOn?: string | null }, today: string): boolean {
  if (window.startsOn && today < window.startsOn) return false;
  if (window.endsOn && today > window.endsOn) return false;
  return true;
}

export type EnrollmentConditions = {
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentDiscountPercent?: number | null;
  /** Último día (inclusive) del descuento; null = sin fecha de fin. */
  enrollmentDiscountUntil?: string | null;
};

export type ResolvedEnrollment = {
  /** Matrícula de lista (antes del descuento); 0 si no cobra. */
  listUsd: number;
  /** Porcentaje aplicado hoy (0 si no hay descuento vigente). */
  discountPercent: number;
  /** Matrícula que paga el estudiante (con descuento); 0 si no cobra o está bonificada al 100 %. */
  netUsd: number;
};

/** Matrícula de lista (1 mes de renta de LISTA o valor manual) y su versión neta con el descuento vigente. */
export function resolveEnrollment(
  conditions: EnrollmentConditions,
  listMonthlyUsd: number,
  today: string,
): ResolvedEnrollment {
  const listUsd =
    conditions.enrollmentFeeMode === "one_month"
      ? listMonthlyUsd
      : conditions.enrollmentFeeMode === "manual"
        ? (conditions.enrollmentFeeUsd ?? 0)
        : 0;
  const pct = conditions.enrollmentDiscountPercent ?? 0;
  const active =
    listUsd > 0 && pct > 0 && isWithinWindow({ endsOn: conditions.enrollmentDiscountUntil ?? null }, today);
  const discountPercent = active ? Math.min(100, pct) : 0;
  return { listUsd, discountPercent, netUsd: roundCents(listUsd * (1 - discountPercent / 100)) };
}

/** Depósito en USD: en meses de renta de lista si hay `depositMode`; si no, el monto fijo (o null si no pide). */
export function resolveDepositUsd(
  conditions: { depositUsd: number | null; depositMode?: DepositMode | null },
  listMonthlyUsd: number,
): number | null {
  if (conditions.depositMode) {
    const option = DEPOSIT_OPTIONS.find((o) => o.mode === conditions.depositMode);
    if (option) return roundCents(listMonthlyUsd * option.months);
  }
  return conditions.depositUsd != null && conditions.depositUsd > 0 ? conditions.depositUsd : null;
}

export type PromotionRow = {
  id: string;
  label: string;
  discountPercent: number;
  roomTypeId: string | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
};

/** Promoción vigente para un tipo: activa, dentro de fechas y del alcance; si hay varias gana la de mayor porcentaje (no se apilan). */
export function pickActivePromotion(promotions: PromotionRow[], roomTypeId: string, today: string): PromotionRow | null {
  let best: PromotionRow | null = null;
  for (const p of promotions) {
    if (!p.isActive) continue;
    if (p.roomTypeId && p.roomTypeId !== roomTypeId) continue;
    if (!isWithinWindow({ startsOn: p.startsOn, endsOn: p.endsOn }, today)) continue;
    if (!best || p.discountPercent > best.discountPercent) best = p;
  }
  return best;
}

export function applyPromotion(listMonthlyUsd: number, percent: number | null | undefined): number {
  if (!percent || percent <= 0) return listMonthlyUsd;
  return roundCents(listMonthlyUsd * (1 - Math.min(PROMOTION_MAX_PERCENT, percent) / 100));
}

export type ReservationMoney = {
  listMonthlyUsd: number;
  /** Renta con promoción: lo que paga el estudiante por mes. */
  monthlyUsd: number;
  promotionPercent: number;
  enrollment: ResolvedEnrollment;
  depositUsd: number | null;
  initialPayment: InitialPayment;
};

/** Resuelve todos los montos de una reserva para un tipo y una promoción dados. Misma función en server y cliente. */
export function resolveReservationMoney(params: {
  listMonthlyUsd: number;
  promotionPercent?: number | null;
  conditions: EnrollmentConditions & {
    depositUsd: number | null;
    depositMode?: DepositMode | null;
    initialPayment: InitialPaymentConfig;
  };
  arsPerUsd: number;
  today: string;
}): ReservationMoney {
  const { listMonthlyUsd, conditions } = params;
  const promotionPercent = params.promotionPercent && params.promotionPercent > 0 ? params.promotionPercent : 0;
  const monthlyUsd = applyPromotion(listMonthlyUsd, promotionPercent);
  const enrollment = resolveEnrollment(conditions, listMonthlyUsd, params.today);
  const depositUsd = resolveDepositUsd(conditions, listMonthlyUsd);
  const initialPayment = buildInitialPayment(conditions.initialPayment, monthlyUsd, params.arsPerUsd, enrollment.netUsd, depositUsd);
  return { listMonthlyUsd, monthlyUsd, promotionPercent, enrollment, depositUsd, initialPayment };
}

export type MoneyConditionsInputResult =
  | {
      ok: true;
      value: {
        enrollmentDiscountPercent: number | null;
        enrollmentDiscountUntil: string | null;
        depositMode: DepositMode | null;
      };
    }
  | { ok: false; error: string };

/**
 * Validación server-side del descuento de matrícula y del depósito (el cliente solo manda intención). El descuento exige
 * matrícula activa; el depósito en meses es excluyente con la matrícula y con el monto fijo.
 */
export function parseMoneyConditionsInput(raw: {
  enrollmentFeeMode: "one_month" | "manual" | null;
  depositUsd: number | null;
  enrollmentDiscountPercent?: unknown;
  enrollmentDiscountUntil?: unknown;
  depositMode?: unknown;
}): MoneyConditionsInputResult {
  let enrollmentDiscountPercent: number | null = null;
  let enrollmentDiscountUntil: string | null = null;
  const rawPct = raw.enrollmentDiscountPercent;
  if (rawPct !== undefined && rawPct !== null && rawPct !== "") {
    const pct = Math.round(Number(rawPct) * 100) / 100;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: "El descuento de la matrícula tiene que estar entre 1% y 100%." };
    }
    if (pct > 0) {
      if (raw.enrollmentFeeMode === null) {
        return { ok: false, error: "Para dar un descuento de matrícula primero tenés que cobrar matrícula." };
      }
      enrollmentDiscountPercent = pct;
    }
  }
  const rawUntil = raw.enrollmentDiscountUntil;
  if (enrollmentDiscountPercent !== null && typeof rawUntil === "string" && rawUntil.trim() !== "") {
    const until = rawUntil.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`))) {
      return { ok: false, error: "La fecha de fin del descuento de matrícula no es válida." };
    }
    enrollmentDiscountUntil = until;
  }

  let depositMode: DepositMode | null = null;
  if (raw.depositMode !== undefined && raw.depositMode !== null && raw.depositMode !== "") {
    depositMode = normalizeDepositMode(raw.depositMode);
    if (!depositMode) return { ok: false, error: "La opción de depósito no es válida." };
    if (raw.enrollmentFeeMode !== null) {
      return { ok: false, error: "El depósito es excluyente con la matrícula: elegí uno de los dos." };
    }
    if (raw.depositUsd != null) {
      return { ok: false, error: "Elegí un depósito en meses de renta o un monto fijo, no los dos." };
    }
  }
  return { ok: true, value: { enrollmentDiscountPercent, enrollmentDiscountUntil, depositMode } };
}

export type PromotionInputResult =
  | {
      ok: true;
      value: { label: string; discountPercent: number; roomTypeId: string | null; startsOn: string; endsOn: string | null };
    }
  | { ok: false; error: string };

/** Validación server-side de una promoción nueva. `today` fija el inicio por defecto y evita fines en el pasado. */
export function parsePromotionInput(
  raw: { label?: unknown; discountPercent?: unknown; roomTypeId?: unknown; startsOn?: unknown; endsOn?: unknown },
  today: string,
): PromotionInputResult {
  const label = typeof raw.label === "string" ? raw.label.trim().replace(/\s+/g, " ") : "";
  if (label.length < PROMOTION_LABEL_MIN || label.length > PROMOTION_LABEL_MAX) {
    return { ok: false, error: `Poné un nombre para la promoción (entre ${PROMOTION_LABEL_MIN} y ${PROMOTION_LABEL_MAX} caracteres).` };
  }
  const pct = Math.round(Number(raw.discountPercent) * 100) / 100;
  if (!Number.isFinite(pct) || pct < 1 || pct > PROMOTION_MAX_PERCENT) {
    return { ok: false, error: `El descuento tiene que estar entre 1% y ${PROMOTION_MAX_PERCENT}%.` };
  }
  const isDate = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  const hasStart = typeof raw.startsOn === "string" && raw.startsOn.trim() !== "";
  const hasEnd = typeof raw.endsOn === "string" && raw.endsOn.trim() !== "";
  if (hasStart && !isDate(raw.startsOn)) return { ok: false, error: "La fecha de inicio no es válida." };
  if (hasEnd && !isDate(raw.endsOn)) return { ok: false, error: "La fecha de fin no es válida." };
  const startsOn = hasStart ? (raw.startsOn as string) : today;
  const endsOn = hasEnd ? (raw.endsOn as string) : null;
  if (endsOn && endsOn < startsOn) return { ok: false, error: "La promoción no puede terminar antes de empezar." };
  if (endsOn && endsOn < today) return { ok: false, error: "La fecha de fin ya pasó: elegí una fecha de hoy en adelante." };
  const roomTypeId = typeof raw.roomTypeId === "string" && raw.roomTypeId.trim() !== "" ? raw.roomTypeId.trim() : null;
  return { ok: true, value: { label, discountPercent: pct, roomTypeId, startsOn, endsOn } };
}
