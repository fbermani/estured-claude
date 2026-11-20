import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { initialPaymentConfigFromRow, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { normalizeDepositMode, type DepositMode } from "@/lib/applications/reservationMoney";

/**
 * Condiciones de reserva a nivel residencia (migración 0025 — antes
 * vivían por tipo de habitación). La matrícula puede ser "equivalente
 * a 1 mes de renta" o un valor manual; depósito y matrícula son
 * excluyentes (constraint en DB). El pago inicial para reservar (D7/H08,
 * migración 0041) es otra condición general: primer mes por defecto o un
 * monto fijo en USD.
 */
export type ResidenceConditions = {
  minimumStayMonths: number | null;
  adjustmentPolicy: string;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  /** DR18 t3 (migración 0060): depósito en meses de renta de lista; null = monto fijo (`depositUsd`). */
  depositMode: DepositMode | null;
  /** DR18 t3: descuento de matrícula (null = sin descuento) y último día (inclusive) en que rige. */
  enrollmentDiscountPercent: number | null;
  enrollmentDiscountUntil: string | null;
  emptyMonthChargePercent: number | null;
  initialPayment: InitialPaymentConfig;
  /** Política de salida anticipada (DR3, migración 0044): texto libre, informativo, público en la ficha. */
  earlyExitDepositClausesText: string | null;
  earlyExitCostsText: string | null;
  earlyExitConditionsText: string | null;
};

export async function getResidenceConditions(
  admin: SupabaseClient,
  residenceId: string,
): Promise<ResidenceConditions | null> {
  const BASE_COLUMNS =
    "minimum_stay_months, adjustment_policy, enrollment_fee_mode, enrollment_fee_usd, enrollment_fee_frequency, deposit_usd, empty_month_charge_percent, reservation_initial_payment_mode, reservation_initial_payment_usd";
  const query = async (columns: string) => {
    const res = await admin.from("residences").select(columns).eq("id", residenceId).maybeSingle();
    return { data: res.data as unknown as Record<string, any> | null, error: res.error }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const EARLY_EXIT_COLUMNS = "early_exit_deposit_clauses_text, early_exit_costs_text, early_exit_conditions_text";
  const MONEY_COLUMNS = "enrollment_discount_percent, enrollment_discount_until, deposit_mode";
  let { data, error } = await query(`${BASE_COLUMNS}, ${EARLY_EXIT_COLUMNS}, ${MONEY_COLUMNS}`);
  // Migración 0060 sin aplicar: se leen las condiciones sin descuento de matrícula ni depósito en meses.
  if (isMissingSchemaError(error)) ({ data, error } = await query(`${BASE_COLUMNS}, ${EARLY_EXIT_COLUMNS}`));
  // Migración 0044 sin aplicar: se leen las condiciones sin la política de salida.
  if (isMissingSchemaError(error)) ({ data, error } = await query(BASE_COLUMNS));
  if (error || !data) return null;
  return {
    minimumStayMonths: data.minimum_stay_months != null ? Number(data.minimum_stay_months) : null,
    adjustmentPolicy: data.adjustment_policy ?? "quarterly",
    enrollmentFeeMode: (data.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
    enrollmentFeeUsd: data.enrollment_fee_usd != null ? Number(data.enrollment_fee_usd) : null,
    enrollmentFeeFrequency: (data.enrollment_fee_frequency as "once" | "annual") ?? "once",
    depositUsd: data.deposit_usd != null ? Number(data.deposit_usd) : null,
    depositMode: normalizeDepositMode(data.deposit_mode),
    enrollmentDiscountPercent:
      data.enrollment_discount_percent != null ? Number(data.enrollment_discount_percent) : null,
    enrollmentDiscountUntil: (data.enrollment_discount_until as string | null) ?? null,
    emptyMonthChargePercent:
      data.empty_month_charge_percent != null ? Number(data.empty_month_charge_percent) : null,
    initialPayment: initialPaymentConfigFromRow(data),
    earlyExitDepositClausesText: (data.early_exit_deposit_clauses_text as string | null) ?? null,
    earlyExitCostsText: (data.early_exit_costs_text as string | null) ?? null,
    earlyExitConditionsText: (data.early_exit_conditions_text as string | null) ?? null,
  };
}
