import { describe, expect, it } from "vitest";
import {
  applyPromotion,
  parseMoneyConditionsInput,
  parsePromotionInput,
  pickActivePromotion,
  resolveDepositUsd,
  resolveEnrollment,
  resolveReservationMoney,
  todayIso,
  type PromotionRow,
} from "@/lib/applications/reservationMoney";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import {
  buildInitialPayment,
  parseInitialPaymentInput,
  resolveNegotiatedInitialPaymentUsd,
} from "@/lib/reservations/initialPayment";

const TODAY = "2026-10-28";
const ONE_MONTH = { mode: "one_month", customUsd: null } as const;
const ENROLLMENT_ONLY = { mode: "enrollment_only", customUsd: null } as const;

describe("resolveEnrollment", () => {
  it("sin matrícula no cobra ni descuenta", () => {
    expect(resolveEnrollment({ enrollmentFeeMode: null, enrollmentFeeUsd: null, enrollmentDiscountPercent: 50 }, 400, TODAY)).toEqual({
      listUsd: 0,
      discountPercent: 0,
      netUsd: 0,
    });
  });
  it("1 mes de renta de lista con 50% vigente", () => {
    const r = resolveEnrollment({ enrollmentFeeMode: "one_month", enrollmentFeeUsd: null, enrollmentDiscountPercent: 50 }, 400, TODAY);
    expect(r).toEqual({ listUsd: 400, discountPercent: 50, netUsd: 200 });
  });
  it("100% deja la matrícula en 0 y el descuento vencido no aplica", () => {
    const free = resolveEnrollment({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 300, enrollmentDiscountPercent: 100 }, 400, TODAY);
    expect(free.netUsd).toBe(0);
    const expired = resolveEnrollment(
      { enrollmentFeeMode: "manual", enrollmentFeeUsd: 300, enrollmentDiscountPercent: 50, enrollmentDiscountUntil: "2026-10-27" },
      400,
      TODAY,
    );
    expect(expired).toEqual({ listUsd: 300, discountPercent: 0, netUsd: 300 });
    const lastDay = resolveEnrollment(
      { enrollmentFeeMode: "manual", enrollmentFeeUsd: 300, enrollmentDiscountPercent: 50, enrollmentDiscountUntil: TODAY },
      400,
      TODAY,
    );
    expect(lastDay.netUsd).toBe(150);
  });
});

describe("resolveDepositUsd", () => {
  it("opciones en meses de renta de lista", () => {
    expect(resolveDepositUsd({ depositUsd: null, depositMode: "half_month" }, 450)).toBe(225);
    expect(resolveDepositUsd({ depositUsd: null, depositMode: "one_month" }, 450)).toBe(450);
    expect(resolveDepositUsd({ depositUsd: null, depositMode: "two_months" }, 450)).toBe(900);
  });
  it("sin modo usa el monto fijo; sin nada, null", () => {
    expect(resolveDepositUsd({ depositUsd: 300 }, 450)).toBe(300);
    expect(resolveDepositUsd({ depositUsd: null }, 450)).toBeNull();
    expect(resolveDepositUsd({ depositUsd: 0 }, 450)).toBeNull();
  });
});

describe("promociones", () => {
  const promo = (over: Partial<PromotionRow>): PromotionRow => ({
    id: "p",
    label: "Promo",
    discountPercent: 10,
    roomTypeId: null,
    startsOn: "2026-10-01",
    endsOn: null,
    isActive: true,
    ...over,
  });
  it("gana la de mayor porcentaje y respeta alcance, vigencia y estado", () => {
    const list = [
      promo({ id: "a", discountPercent: 10 }),
      promo({ id: "b", discountPercent: 20, roomTypeId: "rt1" }),
      promo({ id: "c", discountPercent: 40, roomTypeId: "rt2" }),
      promo({ id: "d", discountPercent: 60, isActive: false }),
      promo({ id: "e", discountPercent: 70, startsOn: "2026-11-01" }),
      promo({ id: "f", discountPercent: 80, endsOn: "2026-10-27" }),
    ];
    expect(pickActivePromotion(list, "rt1", TODAY)?.id).toBe("b");
    expect(pickActivePromotion(list, "rt3", TODAY)?.id).toBe("a");
    expect(pickActivePromotion([], "rt1", TODAY)).toBeNull();
  });
  it("applyPromotion redondea a centavos y no pasa del tope", () => {
    expect(applyPromotion(333, 15)).toBe(283.05);
    expect(applyPromotion(400, null)).toBe(400);
    expect(applyPromotion(400, 99)).toBe(40);
  });
});

describe("resolveReservationMoney + fee sobre lo que paga el estudiante", () => {
  const base = {
    enrollmentFeeMode: "one_month" as const,
    enrollmentFeeUsd: null,
    depositUsd: null,
    initialPayment: ONE_MONTH,
  };
  it("sin descuentos ni promoción mantiene el comportamiento anterior", () => {
    const m = resolveReservationMoney({ listMonthlyUsd: 400, conditions: base, arsPerUsd: 1000, today: TODAY });
    expect(m.monthlyUsd).toBe(400);
    expect(m.enrollment.netUsd).toBe(400);
    expect(m.initialPayment.usd).toBe(400);
    const fee = calculateFeeEstimate({ monthlyPriceUsd: m.monthlyUsd, durationMonths: 6, enrollmentFeeUsd: m.enrollment.netUsd, arsPerUsd: 1000 });
    expect(fee.feeBaseUsd).toBe(2800);
  });
  it("matrícula al 50% y promoción del 10%: la base del fee usa los montos finales", () => {
    const m = resolveReservationMoney({
      listMonthlyUsd: 400,
      promotionPercent: 10,
      conditions: { ...base, enrollmentDiscountPercent: 50 },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(m.monthlyUsd).toBe(360);
    expect(m.enrollment).toEqual({ listUsd: 400, discountPercent: 50, netUsd: 200 });
    const fee = calculateFeeEstimate({ monthlyPriceUsd: m.monthlyUsd, durationMonths: 6, enrollmentFeeUsd: m.enrollment.netUsd, arsPerUsd: 1000 });
    expect(fee.feeBaseUsd).toBe(360 * 6 + 200);
    expect(fee.estimatedFeeArs).toBe(Math.round(fee.feeBaseArs * 0.05));
  });
  it("el depósito en meses no entra a la base del fee", () => {
    const m = resolveReservationMoney({
      listMonthlyUsd: 400,
      conditions: { enrollmentFeeMode: null, enrollmentFeeUsd: null, depositUsd: null, depositMode: "two_months", initialPayment: ONE_MONTH },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(m.depositUsd).toBe(800);
    const fee = calculateFeeEstimate({ monthlyPriceUsd: m.monthlyUsd, durationMonths: 3, enrollmentFeeUsd: m.enrollment.netUsd, arsPerUsd: 1000 });
    expect(fee.feeBaseUsd).toBe(1200);
  });
  it("pago inicial solo matrícula: usa la matrícula neta; sin matrícula o al 100% cae al primer mes con promoción", () => {
    const withDiscount = resolveReservationMoney({
      listMonthlyUsd: 400,
      conditions: { ...base, enrollmentDiscountPercent: 50, initialPayment: ENROLLMENT_ONLY },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(withDiscount.initialPayment.usd).toBe(200);
    expect(withDiscount.initialPayment.mode).toBe("enrollment_only");
    const free = resolveReservationMoney({
      listMonthlyUsd: 400,
      promotionPercent: 25,
      conditions: { ...base, enrollmentDiscountPercent: 100, initialPayment: ENROLLMENT_ONLY },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(free.initialPayment.usd).toBe(300);
    expect(free.initialPayment.mode).toBe("one_month");
    const none = resolveReservationMoney({
      listMonthlyUsd: 400,
      conditions: { enrollmentFeeMode: null, enrollmentFeeUsd: null, depositUsd: null, initialPayment: ENROLLMENT_ONLY },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(none.initialPayment.usd).toBe(400);
  });
});

describe("combinación promo + solo matrícula + matrícula 100%", () => {
  it("el pago inicial cae al primer mes CON promoción y el fee sale solo de la renta final", () => {
    const m = resolveReservationMoney({
      listMonthlyUsd: 500,
      promotionPercent: 20,
      conditions: {
        enrollmentFeeMode: "one_month",
        enrollmentFeeUsd: null,
        enrollmentDiscountPercent: 100,
        depositUsd: null,
        initialPayment: ENROLLMENT_ONLY,
      },
      arsPerUsd: 1000,
      today: TODAY,
    });
    expect(m.monthlyUsd).toBe(400);
    expect(m.enrollment.netUsd).toBe(0);
    expect(m.initialPayment).toMatchObject({ usd: 400, mode: "one_month" });
    const fee = calculateFeeEstimate({ monthlyPriceUsd: m.monthlyUsd, durationMonths: 6, enrollmentFeeUsd: m.enrollment.netUsd, arsPerUsd: 1000 });
    expect(fee.feeBaseUsd).toBe(2400);
  });
});

describe("todayIso (zona Buenos Aires)", () => {
  it("usa el día de Argentina, no el de UTC ni el del servidor", () => {
    expect(todayIso(new Date("2026-10-28T02:00:00Z"))).toBe("2026-10-27");
    expect(todayIso(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
    expect(todayIso(new Date("2026-12-31T23:59:00-03:00"))).toBe("2026-12-31");
  });
});

describe("pago inicial enrollment_only (initialPayment.ts)", () => {
  it("buildInitialPayment sin matrícula nunca devuelve 0", () => {
    expect(buildInitialPayment(ENROLLMENT_ONLY, 400, 1000).usd).toBe(400);
    expect(buildInitialPayment(ENROLLMENT_ONLY, 400, 1000, 0).usd).toBe(400);
    expect(buildInitialPayment(ENROLLMENT_ONLY, 400, 1000, 150).usd).toBe(150);
  });
  it("parseInitialPaymentInput acepta enrollment_only y descarta el monto", () => {
    expect(parseInitialPaymentInput({ mode: "enrollment_only", usd: 99 })).toEqual({
      ok: true,
      value: { mode: "enrollment_only", customUsd: null },
    });
  });
  it("negociación: sigue la matrícula acordada, y a 0 cae al primer mes", () => {
    const common = { proposedUsd: null, originalInitialUsd: 200, originalMonthlyUsd: 400, finalMonthlyUsd: 380, mode: "enrollment_only" as const };
    expect(resolveNegotiatedInitialPaymentUsd({ ...common, originalEnrollmentUsd: 200, finalEnrollmentUsd: 100 })).toBe(100);
    expect(resolveNegotiatedInitialPaymentUsd({ ...common, originalEnrollmentUsd: 200, finalEnrollmentUsd: 0 })).toBe(380);
    // el original no era la matrícula (cayó al primer mes): queda como estaba
    expect(resolveNegotiatedInitialPaymentUsd({ ...common, originalInitialUsd: 400, originalEnrollmentUsd: 0, finalEnrollmentUsd: 100 })).toBe(400);
    // una propuesta explícita siempre gana
    expect(resolveNegotiatedInitialPaymentUsd({ ...common, proposedUsd: 123, originalEnrollmentUsd: 200, finalEnrollmentUsd: 100 })).toBe(123);
  });
});

describe("parseMoneyConditionsInput", () => {
  const ok = (r: ReturnType<typeof parseMoneyConditionsInput>) => (r.ok ? r.value : null);
  it("descuento válido con matrícula y fecha", () => {
    expect(
      ok(parseMoneyConditionsInput({ enrollmentFeeMode: "one_month", depositUsd: null, enrollmentDiscountPercent: 50, enrollmentDiscountUntil: "2026-12-31" })),
    ).toEqual({ enrollmentDiscountPercent: 50, enrollmentDiscountUntil: "2026-12-31", depositMode: null });
  });
  it("rechaza descuento sin matrícula, fuera de rango o fecha inválida", () => {
    expect(parseMoneyConditionsInput({ enrollmentFeeMode: null, depositUsd: null, enrollmentDiscountPercent: 50 }).ok).toBe(false);
    expect(parseMoneyConditionsInput({ enrollmentFeeMode: "manual", depositUsd: null, enrollmentDiscountPercent: 101 }).ok).toBe(false);
    expect(
      parseMoneyConditionsInput({ enrollmentFeeMode: "manual", depositUsd: null, enrollmentDiscountPercent: 10, enrollmentDiscountUntil: "ayer" }).ok,
    ).toBe(false);
  });
  it("0 o vacío = sin descuento (y la fecha se descarta)", () => {
    expect(ok(parseMoneyConditionsInput({ enrollmentFeeMode: "manual", depositUsd: null, enrollmentDiscountPercent: 0, enrollmentDiscountUntil: "2026-12-31" }))).toEqual({
      enrollmentDiscountPercent: null,
      enrollmentDiscountUntil: null,
      depositMode: null,
    });
  });
  it("depósito en meses es excluyente con matrícula y con monto fijo", () => {
    expect(ok(parseMoneyConditionsInput({ enrollmentFeeMode: null, depositUsd: null, depositMode: "one_month" }))?.depositMode).toBe("one_month");
    expect(parseMoneyConditionsInput({ enrollmentFeeMode: "manual", depositUsd: null, depositMode: "one_month" }).ok).toBe(false);
    expect(parseMoneyConditionsInput({ enrollmentFeeMode: null, depositUsd: 200, depositMode: "one_month" }).ok).toBe(false);
    expect(parseMoneyConditionsInput({ enrollmentFeeMode: null, depositUsd: null, depositMode: "tres_meses" }).ok).toBe(false);
  });
});

describe("parsePromotionInput", () => {
  it("válida con defaults", () => {
    const r = parsePromotionInput({ label: "  Promo   invierno ", discountPercent: "15" }, TODAY);
    expect(r).toEqual({ ok: true, value: { label: "Promo invierno", discountPercent: 15, roomTypeId: null, startsOn: TODAY, endsOn: null } });
  });
  it("rechaza nombre corto, porcentaje fuera de rango y fechas incoherentes", () => {
    expect(parsePromotionInput({ label: "a", discountPercent: 10 }, TODAY).ok).toBe(false);
    expect(parsePromotionInput({ label: "Promo", discountPercent: 0 }, TODAY).ok).toBe(false);
    expect(parsePromotionInput({ label: "Promo", discountPercent: 91 }, TODAY).ok).toBe(false);
    expect(parsePromotionInput({ label: "Promo", discountPercent: 10, startsOn: "2026-11-10", endsOn: "2026-11-01" }, TODAY).ok).toBe(false);
    expect(parsePromotionInput({ label: "Promo", discountPercent: 10, endsOn: "2026-10-01" }, TODAY).ok).toBe(false);
  });
});
