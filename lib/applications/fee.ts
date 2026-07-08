import { usdToArsReferencial, roundArs } from "@/lib/mock/exchange";

const FEE_PERCENT = 0.05; // docs/00 §12: 5% fijo

/**
 * Base y estimado del fee EstuRed (docs/00 §12).
 *
 * Base = (meses de estadía × tarifa mensual) + matrícula/cargo de
 * ingreso no reembolsable. Excluye siempre el depósito reembolsable.
 * El cobro real del fee es una fase posterior — esto solo estima para
 * mostrarlo en la comparación de negociación (docs/08 §6.6) y en el
 * snapshot.
 */
export function calculateFeeEstimate(params: {
  monthlyPriceUsd: number;
  durationMonths: number;
  enrollmentFeeUsd?: number | null;
}): { feeBaseUsd: number; feeBaseArs: number; estimatedFeeArs: number } {
  const feeBaseUsd =
    params.monthlyPriceUsd * params.durationMonths + (params.enrollmentFeeUsd ?? 0);
  const feeBaseArs = usdToArsReferencial(feeBaseUsd);
  const estimatedFeeArs = roundArs(feeBaseArs * FEE_PERCENT);
  return { feeBaseUsd, feeBaseArs, estimatedFeeArs };
}
