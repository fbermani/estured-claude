import { describe, expect, it } from "vitest";
import {
  adjustmentPolicyCopy,
  buildConditionItems,
  describeInitialPayment,
  monthsLabel,
  roomTypeSubtitle,
  type FichaConditionsInput,
} from "@/lib/residences/fichaConditions";

const base: FichaConditionsInput = {
  minimumStayMonths: 6,
  adjustmentPolicy: "quarterly",
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  enrollmentFeeFrequency: "once",
  depositUsd: 300,
  emptyMonthChargePercent: 50,
  initialPayment: { mode: "one_month", customUsd: null },
};

const byKey = (items: ReturnType<typeof buildConditionItems>) => Object.fromEntries(items.map((i) => [i.key, i]));

describe("adjustmentPolicyCopy", () => {
  it("traduce cada política y oculta las desconocidas", () => {
    expect(adjustmentPolicyCopy("quarterly")?.help).toBe("La residencia puede actualizar la tarifa cada 3 meses.");
    expect(adjustmentPolicyCopy("none")?.label).toBe("Sin ajuste");
    expect(adjustmentPolicyCopy("???")).toBeNull();
    expect(adjustmentPolicyCopy(null)).toBeNull();
  });
});

describe("buildConditionItems", () => {
  it("muestra las seis condiciones cuando están cargadas", () => {
    const items = byKey(buildConditionItems(base));
    expect(Object.keys(items)).toEqual(["initial_payment", "deposit", "enrollment", "minimum_stay", "adjustment", "advance_booking"]);
    expect(items.initial_payment.value).toBe("Primer mes");
    expect(items.deposit.arsFromUsd).toBe(300);
    expect(items.minimum_stay.value).toBe("6 meses");
    expect(items.advance_booking.value).toBe("50% por mes");
  });

  it("matrícula null = 'No cobra' (no se oculta)", () => {
    expect(byKey(buildConditionItems(base)).enrollment.value).toBe("No cobra");
  });

  it("matrícula de un mes o fija, con su frecuencia", () => {
    const oneMonth = byKey(buildConditionItems({ ...base, enrollmentFeeMode: "one_month", enrollmentFeeFrequency: "annual" }));
    expect(oneMonth.enrollment.value).toBe("1 mes de renta");
    expect(oneMonth.enrollment.valueNote).toBe("anual");
    const fixed = byKey(buildConditionItems({ ...base, enrollmentFeeMode: "manual", enrollmentFeeUsd: 150 }));
    expect(fixed.enrollment.value).toBe("USD 150");
    expect(fixed.enrollment.valueNote).toBe("única vez");
    expect(fixed.enrollment.arsFromUsd).toBe(150);
  });

  it("pago inicial de monto fijo", () => {
    const items = byKey(buildConditionItems({ ...base, initialPayment: { mode: "custom_usd", customUsd: 400 } }));
    expect(items.initial_payment.value).toBe("USD 400");
    expect(items.initial_payment.arsFromUsd).toBe(400);
  });

  it("omite lo que no está cargado, sin inventar", () => {
    const items = byKey(
      buildConditionItems({
        ...base,
        minimumStayMonths: null,
        adjustmentPolicy: null,
        depositUsd: null,
        emptyMonthChargePercent: null,
      }),
    );
    expect(Object.keys(items)).toEqual(["initial_payment", "enrollment"]);
  });
});


describe("roomTypeSubtitle", () => {
  it("arma el subtítulo con lo cargado", () => {
    expect(roomTypeSubtitle({ capacityPerRoom: 2, genderPolicy: "mixto", bathroomType: "compartido" })).toBe(
      "2 personas por habitación · mixta · baño compartido",
    );
    expect(roomTypeSubtitle({ capacityPerRoom: 1, genderPolicy: null, bathroomType: "privado" })).toBe(
      "1 persona por habitación · baño privado",
    );
  });
  it("sin datos devuelve vacío", () => {
    expect(roomTypeSubtitle({ capacityPerRoom: null, genderPolicy: undefined, bathroomType: "otro" })).toBe("");
  });
});

describe("matrícula inconsistente", () => {
  it("manual sin monto válido omite la fila (no afirma 'No cobra')", () => {
    const items = buildConditionItems({ ...base, enrollmentFeeMode: "manual", enrollmentFeeUsd: null });
    expect(items.some((i) => i.key === "enrollment")).toBe(false);
  });
});

describe("describeInitialPayment / monthsLabel", () => {
  it("primer mes por defecto y monto fijo solo si es válido", () => {
    expect(describeInitialPayment({ mode: "one_month", customUsd: null })).toEqual({ kind: "first_month" });
    expect(describeInitialPayment({ mode: "custom_usd", customUsd: 400 })).toEqual({ kind: "fixed", usd: 400 });
    // modo fijo sin monto válido: mismo criterio que el server (cae al primer mes)
    expect(describeInitialPayment({ mode: "custom_usd", customUsd: null })).toEqual({ kind: "first_month" });
    expect(describeInitialPayment({ mode: "custom_usd", customUsd: 0 })).toEqual({ kind: "first_month" });
  });
  it("singular y plural", () => {
    expect(monthsLabel(1)).toBe("1 mes");
    expect(monthsLabel(6)).toBe("6 meses");
  });
});

describe("buildConditionItems: dinero DR18 tanda 3", () => {
  it("pago inicial solo matrícula", () => {
    const items = byKey(buildConditionItems({ ...base, initialPayment: { mode: "enrollment_only", customUsd: null } }));
    expect(items.initial_payment.value).toBe("Solo la matrícula");
    expect(describeInitialPayment({ mode: "enrollment_only", customUsd: null })).toEqual({ kind: "enrollment_only" });
  });
  it("depósito en meses de renta (sin monto en USD)", () => {
    const items = byKey(buildConditionItems({ ...base, depositUsd: null, depositMode: "two_months" }));
    expect(items.deposit.value).toBe("2 meses de renta");
    expect(items.deposit.arsFromUsd).toBeNull();
  });
  it("descuento de matrícula vigente se avisa; vencido no", () => {
    const withMatricula = { ...base, enrollmentFeeMode: "one_month" as const, enrollmentDiscountPercent: 50, enrollmentDiscountUntil: "2026-12-31" };
    expect(byKey(buildConditionItems(withMatricula, "2026-10-28")).enrollment.help).toContain("50% de descuento hasta el");
    expect(byKey(buildConditionItems(withMatricula, "2027-01-02")).enrollment.help).not.toContain("descuento");
    const free = { ...withMatricula, enrollmentDiscountPercent: 100, enrollmentDiscountUntil: null };
    expect(byKey(buildConditionItems(free, "2026-10-28")).enrollment.help).toContain("bonificada");
  });
  it("mes vacío aclara que solo se cobra si la plaza queda vacía", () => {
    expect(byKey(buildConditionItems(base)).advance_booking.help).toContain("realmente vacía");
  });
});
