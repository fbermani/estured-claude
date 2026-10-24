import { describe, expect, it } from "vitest";
import { deriveArsPerUsd, describeFeeCalculation, expectedFeeUsd } from "@/lib/payments/feeCalculation";

// Caso real del seed: base USD 1.900 a ARS 1.480 → base ARS 2.812.000; 5 % = 140.600 → 140.500 redondeado.
const fee = { feeBaseUsd: 1900, feeBaseArs: 2_812_000, feeAmountArs: 140_500, feeAmountUsd: null };

describe("feeCalculation", () => {
  it("deriva la cotización del snapshot de la base guardada", () => {
    expect(deriveArsPerUsd(fee)).toBe(1480);
    expect(deriveArsPerUsd({ feeBaseUsd: 0, feeBaseArs: 10 })).toBeNull();
  });

  it("deriva el fee USD esperado como fee ARS ÷ cotización cuando no está guardado", () => {
    expect(expectedFeeUsd(fee)).toBe(94.93);
  });

  it("usa fee_amount_usd guardado cuando existe", () => {
    expect(expectedFeeUsd({ ...fee, feeAmountUsd: 95 })).toBe(95);
  });

  it("devuelve null si no hay forma de derivar el USD", () => {
    expect(expectedFeeUsd({ feeBaseUsd: 0, feeBaseArs: 0, feeAmountArs: 140_500, feeAmountUsd: null })).toBeNull();
  });

  it("describe el cálculo: base × porcentaje × tipo de cambio", () => {
    const view = describeFeeCalculation(fee);
    expect(view).toMatchObject({ baseUsd: 1900, ratePercent: 5, arsPerUsd: 1480, baseArs: 2_812_000, exactArs: 140_600, feeArs: 140_500 });
    expect(view.feeUsd).toBe(94.93);
  });

  it("respeta fee_rate_percent guardado y cae al 5 % si falta", () => {
    expect(describeFeeCalculation({ ...fee, feeRatePercent: 4 }).ratePercent).toBe(4);
    expect(describeFeeCalculation({ ...fee, feeRatePercent: null }).ratePercent).toBe(5);
  });
});
