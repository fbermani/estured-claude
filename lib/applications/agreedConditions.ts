/**
 * Condiciones acordadas de una solicitud, leídas del SNAPSHOT (auditoría
 * 2026-10-20, H07; docs/02 §12, docs/06 §11.2).
 *
 * Regla: lo que ve el estudiante/familiar de una solicitud sale SIEMPRE del
 * snapshot congelado — el final si existe (hubo propuesta de ajuste
 * aceptada), si no el original — y nunca de `room_types` actual, que la
 * residencia puede cambiar después de enviada la solicitud.
 *
 * Presentación pura: no consulta nada ni cambia reglas de negocio. Los
 * montos que no existen en el snapshot quedan en `null` (no se inventan).
 */

export type SnapshotRow = {
  snapshot_type?: string | null;
  monthly_price_usd: number | string | null;
  monthly_price_ars: number | string | null;
  exchange_rate_ars_per_usd: number | string | null;
  exchange_rate_date?: string | null;
  initial_duration_months: number | null;
  enrollment_fee_usd: number | string | null;
  enrollment_fee_ars: number | string | null;
  deposit_usd: number | string | null;
  deposit_ars: number | string | null;
  adjustment_policy: string | null;
  fee_base_usd: number | string | null;
  fee_base_ars: number | string | null;
  estimated_estured_fee_ars: number | string | null;
  /** Pago inicial para reservar a la residencia (D7/H08), congelado al crear el snapshot. */
  reservation_payment_amount_usd?: number | string | null;
  reservation_payment_amount_ars?: number | string | null;
};

/** Columnas que hay que pedir a `application_snapshots` para armar las condiciones. */
export const SNAPSHOT_COLUMNS =
  "id, snapshot_type, monthly_price_usd, monthly_price_ars, exchange_rate_ars_per_usd, exchange_rate_date, initial_duration_months, enrollment_fee_usd, enrollment_fee_ars, deposit_usd, deposit_ars, adjustment_policy, fee_base_usd, fee_base_ars, estimated_estured_fee_ars, reservation_payment_amount_usd, reservation_payment_amount_ars";

export const ADJUSTMENT_POLICY_LABEL: Record<string, string> = {
  monthly: "Ajuste mensual",
  quarterly: "Ajuste trimestral",
  semiannual: "Ajuste semestral",
  annual: "Ajuste anual",
  none: "Sin ajuste durante la estadía inicial",
};

/** Snapshot que manda: el final si existe, si no el original. */
export function pickSnapshot<T>(original: T | null | undefined, final: T | null | undefined): T | null {
  return final ?? original ?? null;
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type AgreedConditions = {
  /** `true` si el snapshot que manda es el final (hubo propuesta de ajuste aceptada). */
  isFinal: boolean;
  monthlyUsd: number | null;
  monthlyArs: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  durationMonths: number | null;
  /** Matrícula/cargo de ingreso (no reembolsable, entra en la base del fee). */
  enrollmentUsd: number | null;
  enrollmentArs: number | null;
  /** Depósito reembolsable (excluido del fee). */
  depositUsd: number | null;
  depositArs: number | null;
  adjustmentPolicyLabel: string | null;
  feeBaseUsd: number | null;
  feeBaseArs: number | null;
  /** Fee estimado del snapshot; el fee real, una vez creado el pago, sale de `estured_fee_payments`. */
  estimatedFeeArs: number | null;
  /** Pago inicial para reservar (USD/ARS) que se le hace a la residencia; distinto del fee y de la matrícula. */
  initialPaymentUsd: number | null;
  initialPaymentArs: number | null;
};

export function buildAgreedConditions(snapshot: SnapshotRow | null | undefined): AgreedConditions | null {
  if (!snapshot) return null;
  const enrollmentUsd = num(snapshot.enrollment_fee_usd);
  const depositUsd = num(snapshot.deposit_usd);
  const initialPaymentUsd = num(snapshot.reservation_payment_amount_usd);
  return {
    isFinal: snapshot.snapshot_type === "final",
    monthlyUsd: num(snapshot.monthly_price_usd),
    monthlyArs: num(snapshot.monthly_price_ars),
    exchangeRate: num(snapshot.exchange_rate_ars_per_usd),
    exchangeRateDate: snapshot.exchange_rate_date ?? null,
    durationMonths: snapshot.initial_duration_months ?? null,
    enrollmentUsd: enrollmentUsd && enrollmentUsd > 0 ? enrollmentUsd : null,
    enrollmentArs: enrollmentUsd && enrollmentUsd > 0 ? num(snapshot.enrollment_fee_ars) : null,
    depositUsd: depositUsd && depositUsd > 0 ? depositUsd : null,
    depositArs: depositUsd && depositUsd > 0 ? num(snapshot.deposit_ars) : null,
    adjustmentPolicyLabel: snapshot.adjustment_policy
      ? (ADJUSTMENT_POLICY_LABEL[snapshot.adjustment_policy] ?? null)
      : null,
    feeBaseUsd: num(snapshot.fee_base_usd),
    feeBaseArs: num(snapshot.fee_base_ars),
    estimatedFeeArs: num(snapshot.estimated_estured_fee_ars),
    initialPaymentUsd: initialPaymentUsd && initialPaymentUsd > 0 ? initialPaymentUsd : null,
    initialPaymentArs: initialPaymentUsd && initialPaymentUsd > 0 ? num(snapshot.reservation_payment_amount_ars) : null,
  };
}
