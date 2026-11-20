import { describe, expect, it } from "vitest";
import { PAYMENT_STEPS, buildPaidSeparately, estimateFeeFromUsd } from "@/lib/residences/fichaCosts";
import type { FichaConditionsInput } from "@/lib/residences/fichaConditions";

const base: FichaConditionsInput = {
  minimumStayMonths: 6,
  adjustmentPolicy: "quarterly",
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  enrollmentFeeFrequency: "once",
  depositUsd: 300,
  emptyMonthChargePercent: null,
  initialPayment: { mode: "one_month", customUsd: null },
};
const TODAY = "2026-11-17";
const build = (over: Partial<FichaConditionsInput> = {}, fromPriceUsd: number | null = 190) =>
  buildPaidSeparately({ conditions: { ...base, ...over }, fromPriceUsd, arsPerUsd: 1480, today: TODAY });

describe("PAYMENT_STEPS", () => {
  it("son tres, en este orden y con los textos aprobados", () => {
    expect(PAYMENT_STEPS.map((s) => s.title)).toEqual(["Hoy", "Si la residencia confirma", "Cada mes"]);
    expect(PAYMENT_STEPS.map((s) => `${s.title}: ${s.text}`)).toEqual([
      "Hoy: Pedís la habitación.",
      "Si la residencia confirma: Pagás el fee de EstuRed y el primer pago a la residencia.",
      "Cada mes: Alquiler directo a la residencia.",
    ]);
  });
});

describe("estimateFeeFromUsd", () => {
  it("5 % de renta × estadía mínima + matrícula neta, hacia abajo (es un «desde»)", () => {
    expect(estimateFeeFromUsd({ monthlyUsd: 190, minimumStayMonths: 6, enrollmentNetUsd: 0 })).toBe(57);
    expect(estimateFeeFromUsd({ monthlyUsd: 190, minimumStayMonths: 6, enrollmentNetUsd: 190 })).toBe(66);
    expect(estimateFeeFromUsd({ monthlyUsd: 195, minimumStayMonths: 3, enrollmentNetUsd: 0 })).toBe(29);
  });
  it("sin tarifa o sin estadía mínima no inventa un monto", () => {
    expect(estimateFeeFromUsd({ monthlyUsd: null, minimumStayMonths: 6, enrollmentNetUsd: 0 })).toBeNull();
    expect(estimateFeeFromUsd({ monthlyUsd: 190, minimumStayMonths: null, enrollmentNetUsd: 0 })).toBeNull();
    expect(estimateFeeFromUsd({ monthlyUsd: 0, minimumStayMonths: 6, enrollmentNetUsd: 0 })).toBeNull();
  });
});

describe("buildPaidSeparately", () => {
  it("agrupa «A la residencia» y «A EstuRed», con el depósito y el fee en USD y su referencia en ARS", () => {
    const r = build();
    expect(r.groups.map((g) => g.who)).toEqual(["A la residencia", "A EstuRed"]);
    const [res, estured] = r.groups;
    expect(res.rows.map((x) => x.key)).toEqual(["initial_payment", "deposit"]);
    expect(res.rows[0].value).toBe("Primer mes");
    expect(res.rows[1]).toMatchObject({ value: "USD 300", ars: "≈ ARS 444.000" });
    expect(estured.rows[0]).toMatchObject({ key: "fee", value: "desde USD 57", ars: "≈ ARS 84.500" });
    expect(r.hasArs).toBe(true);
  });

  it("siempre «USD», nunca «US$»", () => {
    const all = JSON.stringify(build({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 100 }));
    expect(all).toContain("USD");
    expect(all).not.toContain("US$");
  });

  it("toda fila con monto en USD trae su referencia en ARS", () => {
    const r = build({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 100, initialPayment: { mode: "custom_usd", customUsd: 250 } });
    for (const row of r.groups.flatMap((g) => g.rows)) {
      if (/^(desde )?USD /.test(row.value)) expect(row.ars, row.key).toMatch(/^≈ ARS /);
    }
  });

  it("solo lista lo que cobra: sin depósito ni matrícula queda el pago inicial y el fee", () => {
    const r = build({ depositUsd: null });
    expect(r.groups[0].rows.map((x) => x.key)).toEqual(["initial_payment"]);
  });

  it("la matrícula, si la cobra, suma al fee y aparece como fila", () => {
    const r = build({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 190 });
    expect(r.groups[0].rows.map((x) => x.key)).toContain("enrollment");
    expect(r.groups[1].rows[0].value).toBe("desde USD 66");
  });

  it("el mes vacío aparece solo si la residencia lo cobra", () => {
    expect(build().groups[0].rows.map((x) => x.key)).not.toContain("empty_month");
    expect(build({ emptyMonthChargePercent: 50 }).groups[0].rows.map((x) => x.key)).toContain("empty_month");
  });

  it("sin tarifa o sin estadía mínima el fee dice solo el porcentaje, sin monto ni ARS", () => {
    for (const r of [build({}, null), build({ minimumStayMonths: null })]) {
      const fee = r.groups.find((g) => g.key === "estured")!.rows[0];
      expect(fee.value).toBe("5 %");
      expect(fee.ars).toBeUndefined();
    }
  });

  it("el pie junta el ajuste de tarifa y la matrícula; sin datos es null", () => {
    expect(build().footnote).toBe("La residencia puede actualizar la tarifa cada 3 meses. No cobra matrícula.");
    expect(build({ adjustmentPolicy: null, enrollmentFeeMode: "one_month" }).footnote).toBeNull();
  });

  it("sin ningún monto en pesos no hace falta la nota de cotización", () => {
    const r = build({ depositUsd: null }, null);
    expect(r.hasArs).toBe(false);
  });
});
