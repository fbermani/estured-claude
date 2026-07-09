import { describe, expect, it } from "vitest";
import { calculateFeeEstimate } from "@/lib/applications/fee";

describe("calculateFeeEstimate", () => {
  it("calcula base y fee (5%) incluyendo matrícula, excluyendo depósito (docs/00 §12)", () => {
    const result = calculateFeeEstimate({
      monthlyPriceUsd: 300,
      durationMonths: 6,
      enrollmentFeeUsd: 100,
      arsPerUsd: 1480,
    });
    expect(result.feeBaseUsd).toBe(1900);
    expect(result.feeBaseArs).toBe(2812000);
    expect(result.estimatedFeeArs).toBe(140500);
  });

  it("trata enrollmentFeeUsd ausente o null como 0", () => {
    const withoutEnrollment = calculateFeeEstimate({
      monthlyPriceUsd: 300,
      durationMonths: 6,
      arsPerUsd: 1480,
    });
    const withNull = calculateFeeEstimate({
      monthlyPriceUsd: 300,
      durationMonths: 6,
      enrollmentFeeUsd: null,
      arsPerUsd: 1480,
    });
    expect(withoutEnrollment.feeBaseUsd).toBe(1800);
    expect(withoutEnrollment).toEqual(withNull);
  });

  // Regresión: cifras verificadas a mano y en DB durante el e2e del Ciclo 8
  // (negociación 300→270 USD, MEMORY.md §13cuater).
  it("reproduce el cálculo verificado e2e del Ciclo 8 (negociación 270 USD)", () => {
    const result = calculateFeeEstimate({
      monthlyPriceUsd: 270,
      durationMonths: 6,
      enrollmentFeeUsd: 100,
      arsPerUsd: 1480,
    });
    expect(result.feeBaseUsd).toBe(1720);
    expect(result.feeBaseArs).toBe(2545600);
    expect(result.estimatedFeeArs).toBe(127500);
  });

  // Regresión: cifras verificadas e2e del Ciclo 10 (camino B, MEMORY.md §13sexies).
  it("reproduce el cálculo verificado e2e del Ciclo 10 (1180 USD base, 1520 ARS/USD)", () => {
    const result = calculateFeeEstimate({
      monthlyPriceUsd: 270,
      durationMonths: 4,
      enrollmentFeeUsd: 100,
      arsPerUsd: 1520,
    });
    expect(result.feeBaseUsd).toBe(1180);
    expect(result.estimatedFeeArs).toBe(89500);
  });
});
