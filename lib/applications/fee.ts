import { usdToArs, roundArs } from "@/lib/mock/exchange";

const FEE_PERCENT = 0.05; // docs/00 §12: 5% fijo

/**
 * Base y estimado del fee EstuRed (docs/00 §12).
 *
 * Base = (meses de estadía × tarifa mensual) + matrícula/cargo de
 * ingreso no reembolsable. Excluye siempre el depósito reembolsable.
 * El cobro real del fee es una fase posterior — esto solo estima para
 * mostrarlo en la comparación de negociación (docs/08 §6.6) y en el
 * snapshot. `arsPerUsd` siempre debe venir de la cotización del
 * snapshot correspondiente (nunca recalculada al vuelo en negociación
 * — docs/06 §11.2).
 */
export function calculateFeeEstimate(params: {
  monthlyPriceUsd: number;
  durationMonths: number;
  enrollmentFeeUsd?: number | null;
  arsPerUsd: number;
}): { feeBaseUsd: number; feeBaseArs: number; estimatedFeeArs: number } {
  const feeBaseUsd =
    params.monthlyPriceUsd * params.durationMonths + (params.enrollmentFeeUsd ?? 0);
  const feeBaseArs = usdToArs(feeBaseUsd, params.arsPerUsd);
  const estimatedFeeArs = roundArs(feeBaseArs * FEE_PERCENT);
  return { feeBaseUsd, feeBaseArs, estimatedFeeArs };
}
