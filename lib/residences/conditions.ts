import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialPaymentConfigFromRow, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";

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
  emptyMonthChargePercent: number | null;
  initialPayment: InitialPaymentConfig;
};

export async function getResidenceConditions(
  admin: SupabaseClient,
  residenceId: string,
): Promise<ResidenceConditions | null> {
  const { data, error } = await admin
    .from("residences")
    .select(
      "minimum_stay_months, adjustment_policy, enrollment_fee_mode, enrollment_fee_usd, enrollment_fee_frequency, deposit_usd, empty_month_charge_percent, reservation_initial_payment_mode, reservation_initial_payment_usd",
    )
    .eq("id", residenceId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    minimumStayMonths: data.minimum_stay_months != null ? Number(data.minimum_stay_months) : null,
    adjustmentPolicy: data.adjustment_policy ?? "quarterly",
    enrollmentFeeMode: (data.enrollment_fee_mode as "one_month" | "manual" | null) ?? null,
    enrollmentFeeUsd: data.enrollment_fee_usd != null ? Number(data.enrollment_fee_usd) : null,
    enrollmentFeeFrequency: (data.enrollment_fee_frequency as "once" | "annual") ?? "once",
    depositUsd: data.deposit_usd != null ? Number(data.deposit_usd) : null,
    emptyMonthChargePercent:
      data.empty_month_charge_percent != null ? Number(data.empty_month_charge_percent) : null,
    initialPayment: initialPaymentConfigFromRow(data),
  };
}

/** Matrícula efectiva en USD para una renta mensual dada (modo "1 mes" o manual). */
export function resolveEnrollmentFeeUsd(
  conditions: Pick<ResidenceConditions, "enrollmentFeeMode" | "enrollmentFeeUsd">,
  monthlyPriceUsd: number,
): number | null {
  if (conditions.enrollmentFeeMode === "one_month") return monthlyPriceUsd;
  if (conditions.enrollmentFeeMode === "manual") return conditions.enrollmentFeeUsd;
  return null;
}
