import { describe, expect, it } from "vitest";
import {
  AMOUNT_FLOOR_RATIO,
  AMOUNT_TOLERANCE_RATIO,
  isAmbiguousAmountText,
  compareReceivedAmount,
  evaluateManualFeePayment,
  expectedAmountFor,
  parseReceivedAmount,
  validateManualFeeInput,
  type ManualFeeFacts,
  type ManualFeeInput,
} from "@/lib/payments/evaluateManualFeePayment";

const NOW = new Date("2026-10-24T15:00:00Z");
const IN_5H = "2026-10-24T20:00:00Z";
const AGO_1H = "2026-10-24T14:00:00Z";

const facts: ManualFeeFacts = {
  feeStatus: "pending_manual_payment",
  hasReceipt: true,
  expiresAt: IN_5H,
  feeAmountArs: 140_500,
  feeAmountUsd: null,
  feeBaseUsd: 1900,
  feeBaseArs: 2_812_000,
  reservationStatus: "pending_estured_fee",
  residencePaymentStatus: "reported_received_by_residence",
};

const input: ManualFeeInput = {
  reason: "Comprobante verificado.",
  receivedAmount: "140500",
  paymentCurrency: "ARS",
  intent: "confirm",
  confirmWithoutReceipt: false,
  verified: true,
  acceptAmountDifference: false,
};

const evaluate = (f: Partial<ManualFeeFacts> = {}, i: Partial<ManualFeeInput> = {}, actorRole: "admin" | "superadmin" = "admin") =>
  evaluateManualFeePayment({ facts: { ...facts, ...f }, input: { ...input, ...i }, actorRole, now: NOW });

const errorOf = (r: ReturnType<typeof evaluate>) => (r.ok ? null : r.error);

describe("parseReceivedAmount", () => {
  it("acepta enteros, el punto decimal canónico del input numérico y la coma decimal es-AR", () => {
    expect(parseReceivedAmount("140500")).toBe(140500);
    expect(parseReceivedAmount("140500.5")).toBe(140500.5);
    expect(parseReceivedAmount("140500.50")).toBe(140500.5);
    expect(parseReceivedAmount("140500,5")).toBe(140500.5);
    expect(parseReceivedAmount("140500,50")).toBe(140500.5);
    expect(parseReceivedAmount("140.500,50")).toBe(140500.5);
    expect(parseReceivedAmount("1.234.567,5")).toBe(1234567.5);
    expect(parseReceivedAmount(" ARS 140500 ")).toBe(140500);
    expect(parseReceivedAmount("$ 1.250,75")).toBe(1250.75);
    expect(parseReceivedAmount("94.93")).toBe(94.93);
    expect(parseReceivedAmount(95.25)).toBe(95.25);
  });
  it("rechaza los formatos ambiguos de miles/decimales en vez de adivinar (es dinero)", () => {
    // "140.500" podría ser 140,5 o 140500; "1,234.5" es formato en-US; "1,234" podría ser 1,234 o 1234.
    for (const ambiguous of ["1.234", "140.500", "1.234.567", "1,234", "140,500", "1,234.5", "1.234,567", "1,234,567", "12,3,4"]) {
      expect(parseReceivedAmount(ambiguous), ambiguous).toBeNull();
      expect(isAmbiguousAmountText(ambiguous), ambiguous).toBe(true);
    }
    expect(isAmbiguousAmountText("140500")).toBe(false);
    expect(isAmbiguousAmountText("140.500,50")).toBe(false);
    expect(isAmbiguousAmountText("abc")).toBe(false);
  });
  it("rechaza lo que no es un número", () => {
    for (const bad of ["", "abc", "1e5", "-5", "1,", ".5", null, undefined, Number.NaN]) {
      expect(parseReceivedAmount(bad as never)).toBeNull();
    }
  });
});

describe("compareReceivedAmount", () => {
  it("1 % exacto es tolerable; un centavo más no", () => {
    expect(compareReceivedAmount(100_000, 101_000).withinTolerance).toBe(true);
    expect(compareReceivedAmount(100_000, 99_000).withinTolerance).toBe(true);
    expect(compareReceivedAmount(100_000, 101_001).withinTolerance).toBe(false);
    expect(AMOUNT_TOLERANCE_RATIO).toBe(0.01);
  });
  it("el límite exacto del 1 % pasa con la base real del fee (140.500) y un centavo de más no", () => {
    // 1 % de 140500 = 1405.00
    expect(compareReceivedAmount(140_500, 141_905).withinTolerance).toBe(true);
    expect(compareReceivedAmount(140_500, 139_095).withinTolerance).toBe(true);
    expect(compareReceivedAmount(140_500, 141_905.01).withinTolerance).toBe(false);
    expect(compareReceivedAmount(140_500, 139_094.99).withinTolerance).toBe(false);
  });
  it("el piso del 90 %: justo 90 % no está por debajo; un centavo menos sí; pagar de más nunca activa el piso", () => {
    expect(AMOUNT_FLOOR_RATIO).toBe(0.9);
    expect(compareReceivedAmount(100_000, 90_000).belowFloor).toBe(false);
    expect(compareReceivedAmount(100_000, 89_999.99).belowFloor).toBe(true);
    expect(compareReceivedAmount(100_000, 150_000).belowFloor).toBe(false);
  });
  it("marca coincidencia exacta y calcula la diferencia", () => {
    expect(compareReceivedAmount(140_500, 140_500)).toMatchObject({ exact: true, difference: 0 });
    expect(compareReceivedAmount(140_500, 140_000)).toMatchObject({ exact: false, difference: -500 });
  });
});

describe("expectedAmountFor", () => {
  it("ARS usa el fee guardado; USD lo deriva con la cotización del snapshot", () => {
    expect(expectedAmountFor("ARS", facts)).toBe(140_500);
    expect(expectedAmountFor("USD", facts)).toBe(94.93);
    expect(expectedAmountFor("EUR", facts)).toBeNull();
  });
});

describe("validateManualFeeInput (sin tocar la base)", () => {
  it("exige motivo, moneda válida, monto y 'Verifiqué el pago'", () => {
    expect(validateManualFeeInput({ ...input, reason: "abc" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, paymentCurrency: "EUR" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: "" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: "0" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: "5000000000" })).toMatchObject({ ok: false });
    // El mínimo se valida DESPUÉS de redondear a centavos: 0.001 redondea a 0 y no puede pasar.
    expect(validateManualFeeInput({ ...input, receivedAmount: "0.001" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: "0.0041" })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: 0.001 })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, receivedAmount: "0.01" })).toMatchObject({ ok: true });
    expect(validateManualFeeInput({ ...input, receivedAmount: "0.0061" })).toMatchObject({ ok: true, value: { receivedAmount: 0.01 } });
    const ambiguous = validateManualFeeInput({ ...input, receivedAmount: "140.500" });
    expect(ambiguous).toMatchObject({ ok: false });
    if (!ambiguous.ok) expect(ambiguous.error).toMatch(/ambiguo/);
    expect(validateManualFeeInput({ ...input, verified: false })).toMatchObject({ ok: false });
    expect(validateManualFeeInput({ ...input, intent: "otra" })).toMatchObject({ ok: false });
  });
  it("el override exige motivo de 10 caracteres y la segunda confirmación", () => {
    const override = { ...input, intent: "confirm_without_receipt", confirmWithoutReceipt: true, reason: "Soporte lo vio en el banco" };
    expect(validateManualFeeInput(override)).toMatchObject({ ok: true });
    expect(validateManualFeeInput({ ...override, reason: "corto ok" })).toMatchObject({ ok: false });
    const noAck = validateManualFeeInput({ ...override, confirmWithoutReceipt: false });
    expect(noAck).toMatchObject({ ok: false });
  });
});

describe("evaluateManualFeePayment", () => {
  it("con comprobante y monto exacto, sigue", () => {
    const r = evaluate();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan).toMatchObject({ exact: true, withinTolerance: true, confirmedWithoutReceipt: false, hadReceipt: true, expectedAmount: 140_500 });
    }
  });

  it("no frena una diferencia de redondeo (≤ 1 %) y la deja en el plan", () => {
    const r = evaluate({}, { receivedAmount: "140000" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan).toMatchObject({ exact: false, withinTolerance: true, difference: -500 });
  });

  it("una diferencia > 1 % exige el checkbox de aceptación y motivo de 10+ caracteres", () => {
    const longReason = "Pagó de menos, completa mañana";
    // sin checkbox: rechaza aunque el motivo sea largo
    expect(errorOf(evaluate({}, { receivedAmount: "130000", reason: longReason }))).toMatch(/Marcá que aceptás la diferencia/);
    // con checkbox pero motivo corto: rechaza
    expect(errorOf(evaluate({}, { receivedAmount: "130000", reason: "ok ok ok", acceptAmountDifference: true }))).toMatch(/difiere/);
    const r = evaluate({}, { receivedAmount: "130000", reason: longReason, acceptAmountDifference: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan).toMatchObject({ withinTolerance: false, belowFloor: false, amountDifferenceAccepted: true });
  });

  it("el checkbox no hace falta dentro de la tolerancia del 1 %", () => {
    const r = evaluate({}, { receivedAmount: "141905" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.amountDifferenceAccepted).toBe(false);
  });

  it("pagar de más (> 1 %) también exige el checkbox, pero no el piso", () => {
    expect(errorOf(evaluate({}, { receivedAmount: "200000", reason: "Pagó de más por error" }))).toMatch(/aceptás la diferencia/);
    expect(evaluate({}, { receivedAmount: "200000", reason: "Pagó de más por error", acceptAmountDifference: true }).ok).toBe(true);
  });

  it("piso del 90 %: un admin no puede confirmar menos del 90 %, un superadmin sí (con checkbox y motivo)", () => {
    const below = { receivedAmount: "120000", reason: "Pagó de menos, completa mañana", acceptAmountDifference: true };
    expect(errorOf(evaluate({}, below, "admin"))).toMatch(/superadmin/);
    // ni siquiera el checkbox habilita al admin
    expect(errorOf(evaluate({}, { ...below, receivedAmount: "126449.99" }, "admin"))).toMatch(/superadmin/);
    const asSuper = evaluate({}, below, "superadmin");
    expect(asSuper.ok).toBe(true);
    if (asSuper.ok) expect(asSuper.plan).toMatchObject({ belowFloor: true, amountDifferenceAccepted: true });
    // el superadmin tampoco se salta el checkbox ni el motivo
    expect(errorOf(evaluate({}, { ...below, acceptAmountDifference: false }, "superadmin"))).toMatch(/aceptás la diferencia/);
    expect(errorOf(evaluate({}, { ...below, reason: "corto ok" }, "superadmin"))).toMatch(/difiere/);
    // justo el 90 % no está debajo del piso: el admin lo confirma con checkbox y motivo
    expect(evaluate({}, { ...below, receivedAmount: "126450" }, "admin").ok).toBe(true);
  });

  it("compara contra lo guardado en la moneda elegida (USD derivado)", () => {
    expect(evaluate({}, { paymentCurrency: "USD", receivedAmount: "94.93" }).ok).toBe(true);
    expect(errorOf(evaluate({}, { paymentCurrency: "USD", receivedAmount: "140500", reason: "ok ok ok" }))).toMatch(/difiere/);
    // 94.93 USD esperados: recibir 80 USD (84 %) está bajo el piso, aunque se tilde la aceptación
    expect(
      errorOf(evaluate({}, { paymentCurrency: "USD", receivedAmount: "80", reason: "Pagó de menos en dólares", acceptAmountDifference: true })),
    ).toMatch(/superadmin/);
  });

  it("sin comprobante y sin override no se puede", () => {
    expect(errorOf(evaluate({ hasReceipt: false, feeStatus: "pending_payment_method" }))).toMatch(/comprobante/);
    // pending_manual_payment sin archivo (no debería pasar) tampoco vale como "con comprobante".
    expect(errorOf(evaluate({ hasReceipt: false }))).toMatch(/comprobante/);
    // comprobante cargado pero el fee sigue esperando medio de pago: mensaje propio.
    expect(errorOf(evaluate({ feeStatus: "pending_payment_method" }))).toMatch(/todavía no pasó a revisión manual/);
  });

  it("override sin comprobante: pasa con motivo largo y segunda confirmación, y queda marcado", () => {
    const override = {
      intent: "confirm_without_receipt",
      confirmWithoutReceipt: true,
      reason: "Soporte confirmó el movimiento en el banco.",
    };
    const r = evaluate({ hasReceipt: false, feeStatus: "pending_payment_method" }, override);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan).toMatchObject({ confirmedWithoutReceipt: true, hadReceipt: false });
    expect(errorOf(evaluate({ hasReceipt: false, feeStatus: "pending_payment_method" }, { ...override, confirmWithoutReceipt: false }))).toMatch(/sin comprobante/);
    expect(errorOf(evaluate({ hasReceipt: false, feeStatus: "pending_payment_method" }, { ...override, reason: "muy corto" }))).toMatch(/10 caracteres/);
  });

  it("el override no vale si ya hay un comprobante cargado", () => {
    const r = evaluate({}, { intent: "confirm_without_receipt", confirmWithoutReceipt: true, reason: "Motivo suficientemente largo" });
    expect(errorOf(r)).toMatch(/comprobante cargado/);
  });

  it("un fee vencido (por fecha o por estado) no se puede marcar pagado y apunta a reabrir el plazo", () => {
    expect(errorOf(evaluate({ expiresAt: AGO_1H }))).toMatch(/Reabrilo/);
    expect(errorOf(evaluate({ expiresAt: NOW.toISOString() }))).toMatch(/Reabrilo/);
    expect(errorOf(evaluate({ feeStatus: "expired", expiresAt: AGO_1H }))).toMatch(/Reabrilo/);
  });

  it("rechaza estados que ya no están pendientes (doble confirmación)", () => {
    for (const feeStatus of ["paid", "refunded", "failed", "processing"]) {
      expect(errorOf(evaluate({ feeStatus }))).toMatch(/ya no está pendiente/);
    }
  });

  it("exige reserva pendiente y pago a la residencia confirmado", () => {
    expect(errorOf(evaluate({ reservationStatus: "confirmed" }))).toMatch(/reserva ya no está esperando/);
    expect(errorOf(evaluate({ reservationStatus: null }))).toMatch(/reserva ya no está esperando/);
    expect(errorOf(evaluate({ residencePaymentStatus: "pending" }))).toMatch(/residencia/);
  });

  it("no se puede evitar 'Verifiqué el pago' ni el monto", () => {
    expect(errorOf(evaluate({}, { verified: false }))).toMatch(/verificaste/);
    expect(errorOf(evaluate({}, { receivedAmount: null }))).toMatch(/monto/);
  });

  it("sin forma de calcular el esperado en USD, pide ARS en vez de aceptar a ciegas", () => {
    const r = evaluate({ feeBaseUsd: 0, feeBaseArs: 0 }, { paymentCurrency: "USD", receivedAmount: "95" });
    expect(errorOf(r)).toMatch(/fee esperado/);
  });
});
