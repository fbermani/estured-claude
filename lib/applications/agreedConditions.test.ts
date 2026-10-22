import { describe, expect, it } from "vitest";
import { buildAgreedConditions, pickSnapshot, type SnapshotRow } from "@/lib/applications/agreedConditions";

const original: SnapshotRow = {
  snapshot_type: "original",
  monthly_price_usd: "300.00",
  monthly_price_ars: "444000.00",
  exchange_rate_ars_per_usd: "1480.000000",
  exchange_rate_date: "2026-07-01",
  initial_duration_months: 6,
  enrollment_fee_usd: "50.00",
  enrollment_fee_ars: "74000.00",
  deposit_usd: "300.00",
  deposit_ars: "444000.00",
  adjustment_policy: "quarterly",
  fee_base_usd: "1850.00",
  fee_base_ars: "2738000.00",
  estimated_estured_fee_ars: "137000.00",
  reservation_payment_amount_usd: "450.00",
  reservation_payment_amount_ars: "666000.00",
};

describe("pickSnapshot", () => {
  it("prefiere el final y cae al original", () => {
    expect(pickSnapshot("o", "f")).toBe("f");
    expect(pickSnapshot("o", null)).toBe("o");
    expect(pickSnapshot(null, undefined)).toBeNull();
  });
});

describe("buildAgreedConditions", () => {
  it("convierte los numeric de Postgres y traduce la política de ajuste", () => {
    const c = buildAgreedConditions(original)!;
    expect(c.monthlyUsd).toBe(300);
    expect(c.exchangeRate).toBe(1480);
    expect(c.enrollmentUsd).toBe(50);
    expect(c.depositUsd).toBe(300);
    expect(c.feeBaseUsd).toBe(1850);
    expect(c.estimatedFeeArs).toBe(137000);
    expect(c.adjustmentPolicyLabel).toBe("Ajuste trimestral");
    expect(c.isFinal).toBe(false);
  });

  it("expone el pago inicial a la residencia desde el snapshot (D7/H08)", () => {
    const c = buildAgreedConditions(original)!;
    expect(c.initialPaymentUsd).toBe(450);
    expect(c.initialPaymentArs).toBe(666000);
  });

  it("snapshots sin pago inicial (columna ausente o en 0) no lo muestran", () => {
    const { reservation_payment_amount_usd: _usd, reservation_payment_amount_ars: _ars, ...legacy } = original;
    void _usd;
    void _ars;
    const c = buildAgreedConditions(legacy)!;
    expect(c.initialPaymentUsd).toBeNull();
    expect(c.initialPaymentArs).toBeNull();
    expect(buildAgreedConditions({ ...original, reservation_payment_amount_usd: 0 })!.initialPaymentUsd).toBeNull();
  });

  it("matrícula/depósito en 0 o ausentes quedan en null (no se muestran)", () => {
    const c = buildAgreedConditions({ ...original, enrollment_fee_usd: 0, deposit_usd: null })!;
    expect(c.enrollmentUsd).toBeNull();
    expect(c.enrollmentArs).toBeNull();
    expect(c.depositUsd).toBeNull();
  });

  it("marca isFinal cuando el snapshot que manda es el final", () => {
    expect(buildAgreedConditions({ ...original, snapshot_type: "final" })!.isFinal).toBe(true);
  });

  it("sin snapshot devuelve null en vez de inventar datos", () => {
    expect(buildAgreedConditions(null)).toBeNull();
  });
});
