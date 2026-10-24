import { FEE_PERCENT } from "@/lib/applications/fee";

/**
 * Cálculo del fee EstuRed a partir de lo guardado en `estured_fee_payments` (docs/04 §8.3, §8.6, docs/06 §13.2). Funciones puras, sin I/O:
 * las usa la pantalla del admin para mostrar de dónde sale el monto y `evaluateManualFeePayment` para saber cuánto USD se esperaba.
 *
 * El tipo de cambio no se guarda como columna del fee: es el del snapshot, y queda implícito en `fee_base_ars / fee_base_usd`
 * (la base ARS sale de `usdToArs(base_usd, cotización_del_snapshot)`), así que se deriva de ahí.
 */

export type StoredFee = {
  feeBaseUsd: number;
  feeBaseArs: number;
  feeAmountArs: number;
  /** `fee_amount_usd`: hoy el alta del fee no lo completa, así que suele ser `null` y se deriva. */
  feeAmountUsd: number | null;
  /** `fee_rate_percent` (5.00). Si no viene se usa el 5 % oficial. */
  feeRatePercent?: number | null;
};

/** Cotización del snapshot (ARS por USD) derivada de la base guardada; `null` si no se puede derivar. */
export function deriveArsPerUsd(fee: Pick<StoredFee, "feeBaseUsd" | "feeBaseArs">): number | null {
  if (!(fee.feeBaseUsd > 0) || !(fee.feeBaseArs > 0)) return null;
  return fee.feeBaseArs / fee.feeBaseUsd;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fee esperado en USD: el guardado, o `fee_amount_ars ÷ cotización del snapshot` (docs/06 §13.2). `null` si no hay forma de derivarlo. */
export function expectedFeeUsd(fee: StoredFee): number | null {
  if (fee.feeAmountUsd !== null && fee.feeAmountUsd !== undefined && Number.isFinite(fee.feeAmountUsd) && fee.feeAmountUsd > 0) {
    return round2(fee.feeAmountUsd);
  }
  const rate = deriveArsPerUsd(fee);
  if (!rate || !(fee.feeAmountArs > 0)) return null;
  return round2(fee.feeAmountArs / rate);
}

export type FeeCalculationView = {
  baseUsd: number;
  ratePercent: number;
  /** Cotización del snapshot (ARS por USD), o `null` si no se puede derivar. */
  arsPerUsd: number | null;
  baseArs: number;
  /** Fee exacto antes de redondear a múltiplos de 500 ARS. */
  exactArs: number;
  /** Fee a cobrar en ARS (guardado, ya redondeado). */
  feeArs: number;
  /** Fee esperado en USD (guardado o derivado). */
  feeUsd: number | null;
};

export function describeFeeCalculation(fee: StoredFee): FeeCalculationView {
  const ratePercent = fee.feeRatePercent && fee.feeRatePercent > 0 ? fee.feeRatePercent : FEE_PERCENT * 100;
  return {
    baseUsd: fee.feeBaseUsd,
    ratePercent,
    arsPerUsd: deriveArsPerUsd(fee),
    baseArs: fee.feeBaseArs,
    exactArs: Math.round(fee.feeBaseArs * (ratePercent / 100)),
    feeArs: fee.feeAmountArs,
    feeUsd: expectedFeeUsd(fee),
  };
}
