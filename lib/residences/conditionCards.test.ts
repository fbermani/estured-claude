import { describe, expect, it } from "vitest";
import type { FichaConditionsInput } from "@/lib/residences/fichaConditions";
import { buildConditionRows, visibleConditionCards } from "@/lib/residences/conditionCards";
import { EMPTY_MONTH_IDEA, emptyMonthExample } from "@/lib/residences/emptyMonthCopy";

const none: FichaConditionsInput = {
  minimumStayMonths: null,
  adjustmentPolicy: null,
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  enrollmentFeeFrequency: "once",
  depositUsd: null,
  emptyMonthChargePercent: null,
  initialPayment: { mode: "one_month", customUsd: null },
};

const keys = (i: FichaConditionsInput) => visibleConditionCards(buildConditionRows(i)).map((r) => r.key);

describe("tarjetas de condiciones (DR53)", () => {
  it("las seis condiciones siempre existen para el expander, en orden fijo", () => {
    expect(buildConditionRows(none).map((r) => r.key)).toEqual([
      "initial_payment", "enrollment", "deposit", "adjustment", "empty_month", "documents",
    ]);
  });

  it("residencia que no cobra nada salvo el pago inicial: una sola tarjeta", () => {
    expect(keys(none)).toEqual(["initial_payment"]);
    expect(keys({ ...none, emptyMonthChargePercent: 0 })).toEqual(["initial_payment"]);
  });

  it("cobra todo: pago inicial, matrícula, depósito y mes vacío (sin ajuste ni documentos)", () => {
    const all: FichaConditionsInput = {
      ...none,
      adjustmentPolicy: "quarterly",
      enrollmentFeeMode: "manual",
      enrollmentFeeUsd: 150,
      depositUsd: 300,
      emptyMonthChargePercent: 50,
    };
    expect(keys(all)).toEqual(["initial_payment", "enrollment", "deposit", "empty_month"]);
  });

  it("solo depósito", () => {
    expect(keys({ ...none, depositUsd: 200 })).toEqual(["initial_payment", "deposit"]);
  });

  it("matrícula equivalente a un mes cuenta como que cobra", () => {
    expect(keys({ ...none, enrollmentFeeMode: "one_month" })).toEqual(["initial_payment", "enrollment"]);
  });

  it("lo que no cobra queda en las filas del expander con su texto «No cobra»", () => {
    const rows = buildConditionRows(none);
    const by = (k: string) => rows.find((r) => r.key === k)!;
    expect(by("enrollment").value).toBe("No cobra");
    expect(by("deposit").value).toBe("No cobra");
    expect(by("empty_month").value).toBe("No cobra mes vacío");
    expect(by("adjustment").value).toBe("A coordinar con la residencia");
    expect(by("documents").charges).toBe(false);
  });

  it("mes vacío: dato corto con el porcentaje; null o 0 no genera tarjeta", () => {
    const row = buildConditionRows({ ...none, emptyMonthChargePercent: 75 }).find((r) => r.key === "empty_month")!;
    expect(row.charges).toBe(true);
    expect(row.value).toBe("75 % de la renta");
    expect(row.emptyPercent).toBe(75);
    expect(keys({ ...none, emptyMonthChargePercent: null })).not.toContain("empty_month");
  });
});

describe("copy del mes vacío", () => {
  it("la idea central aclara que no es la renta entera y no la presenta como descuento", () => {
    expect(EMPTY_MONTH_IDEA).toContain("no la renta entera");
    expect(EMPTY_MONTH_IDEA).not.toMatch(/descuento/i);
  });
  it("el ejemplo hace la cuenta con el porcentaje de la residencia", () => {
    expect(emptyMonthExample(50)).toContain("1,5 meses × 50 % = 0,75");
    expect(emptyMonthExample(100)).toContain("1,5 meses × 100 % = 1,5");
    expect(emptyMonthExample(25)).toContain("0,38");
  });
});
