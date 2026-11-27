import { describe, expect, it } from "vitest";
import {
  parseReservationPaymentCurrency,
  reportedAmountColumns,
  resolveAgreedReservationAmount,
} from "@/lib/reservations/agreedReservationAmount";

describe("resolveAgreedReservationAmount (DR70 (a))", () => {
  const snapshot = { monthly_price_usd: 300, exchange_rate_ars_per_usd: 1520 };

  it("usa los montos congelados en el pago cuando están", () => {
    const result = resolveAgreedReservationAmount({ expectedUsd: 280, expectedArs: 425600, snapshot });
    expect(result).toEqual({ ok: true, value: { usd: 280, ars: 425600 } });
  });

  it("sin montos congelados (contacto directo) los saca del snapshot", () => {
    const result = resolveAgreedReservationAmount({ expectedUsd: null, expectedArs: null, snapshot });
    expect(result).toEqual({ ok: true, value: { usd: 300, ars: 456000 } });
  });

  it("acepta montos como texto (numeric de Postgres)", () => {
    const result = resolveAgreedReservationAmount({ expectedUsd: "280.00", expectedArs: "425600.00", snapshot: null });
    expect(result).toEqual({ ok: true, value: { usd: 280, ars: 425600 } });
  });

  it("con un solo monto congelado vuelve al snapshot", () => {
    const result = resolveAgreedReservationAmount({ expectedUsd: 280, expectedArs: null, snapshot });
    expect(result).toEqual({ ok: true, value: { usd: 300, ars: 456000 } });
  });

  it("sin pago ni snapshot no inventa un monto", () => {
    const result = resolveAgreedReservationAmount({ expectedUsd: null, expectedArs: null, snapshot: null });
    expect(result.ok).toBe(false);
  });
});

describe("parseReservationPaymentCurrency", () => {
  it("acepta ARS y USD", () => {
    expect(parseReservationPaymentCurrency("ARS")).toEqual({ ok: true, value: "ARS" });
    expect(parseReservationPaymentCurrency("USD")).toEqual({ ok: true, value: "USD" });
  });

  it("rechaza vacío, null y otros valores", () => {
    for (const raw of [null, undefined, "", "EUR", "ars", 1]) {
      const result = parseReservationPaymentCurrency(raw);
      expect(result.ok).toBe(false);
    }
  });
});

describe("reportedAmountColumns", () => {
  const amount = { usd: 300, ars: 456000 };

  it("en pesos guarda solo el monto en pesos", () => {
    expect(reportedAmountColumns("ARS", amount)).toEqual({ amount_reported_ars: 456000, amount_reported_usd: null });
  });

  it("en dólares guarda solo el monto en dólares", () => {
    expect(reportedAmountColumns("USD", amount)).toEqual({ amount_reported_ars: null, amount_reported_usd: 300 });
  });
});
