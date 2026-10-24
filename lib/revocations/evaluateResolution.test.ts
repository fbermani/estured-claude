import { describe, expect, it } from "vitest";
import {
  buenosAiresDateString,
  evaluateRevocationResolution,
  isRevocationPending,
  type RevocationFacts,
  type RevocationResolutionInput,
} from "@/lib/revocations/evaluateResolution";

const NOW = new Date("2026-10-24T15:00:00.000Z");
const PAID = "2026-10-20T12:00:00.000Z";

const pending: RevocationFacts = {
  reservationStatus: "cancelled_by_student",
  cancellationReasonCode: "student_revocation_right",
  revokedAt: "2026-10-20T18:00:00.000Z", // día 1 de 10
  feeStatus: "paid",
  feeAmountArs: 67000,
  paidAt: PAID,
  revocationResolution: null,
};

const refundInput: RevocationResolutionInput = {
  decision: "refunded",
  internalReason: "Dentro de plazo y sin indicios de bypass.",
  studentMessage: null,
  confirmRefundAmountArs: 67000,
  refundMethod: "bank_transfer",
  refundReference: "OP-123456",
  refundedOn: "2026-10-24",
  justifiedCause: false,
  confirmDenial: false,
};

const denyInput: RevocationResolutionInput = {
  decision: "denied",
  internalReason: "Usó el contacto para acordar por fuera de la plataforma.",
  studentMessage: "  Detectamos un acuerdo por fuera de EstuRed.  ",
  confirmRefundAmountArs: null,
  refundMethod: null,
  refundReference: null,
  refundedOn: null,
  justifiedCause: true,
  confirmDenial: true,
};

const run = (input: Partial<RevocationResolutionInput>, facts: Partial<RevocationFacts> = {}) =>
  evaluateRevocationResolution({ facts: { ...pending, ...facts }, input: { ...refundInput, ...input }, actorUserId: "admin-1", now: NOW });

describe("isRevocationPending", () => {
  it("pendiente = reserva revocada + fee paid + sin resolución", () => {
    expect(isRevocationPending(pending)).toBe(true);
    expect(isRevocationPending({ ...pending, revocationResolution: "refunded" })).toBe(false);
    expect(isRevocationPending({ ...pending, feeStatus: "refunded" })).toBe(false);
    expect(isRevocationPending({ ...pending, reservationStatus: "confirmed" })).toBe(false);
    expect(isRevocationPending({ ...pending, cancellationReasonCode: null })).toBe(false);
  });
});

describe("evaluateRevocationResolution — comunes", () => {
  it("exige una decisión válida", () => {
    expect(run({ decision: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/reintegrás|denegás/i) });
    expect(run({ decision: "paid" }).ok).toBe(false);
  });

  it("motivo obligatorio: 10 a 1000 caracteres (se recorta antes de contar)", () => {
    expect(run({ internalReason: "corto" })).toMatchObject({ ok: false, error: expect.stringMatching(/al menos 10/) });
    expect(run({ internalReason: "   " + "a".repeat(5) + "   " }).ok).toBe(false);
    expect(run({ internalReason: "a".repeat(1001) })).toMatchObject({ ok: false, error: expect.stringMatching(/1000/) });
    expect(run({ internalReason: "a".repeat(10) }).ok).toBe(true);
    expect(run({ internalReason: "a".repeat(1000) }).ok).toBe(true);
  });

  it("el mensaje al estudiante admite hasta 1000 caracteres", () => {
    expect(run({ studentMessage: "a".repeat(1001) }).ok).toBe(false);
    expect(run({ studentMessage: "a".repeat(1000) }).ok).toBe(true);
  });

  it("no resuelve dos veces ni una revocación que no está pendiente", () => {
    expect(run({}, { revocationResolution: "refunded" })).toMatchObject({ ok: false, error: expect.stringMatching(/ya fue resuelta/i) });
    expect(run({}, { feeStatus: "refunded" })).toMatchObject({ ok: false, error: expect.stringMatching(/no está pendiente/i) });
    expect(run({}, { reservationStatus: "confirmed" }).ok).toBe(false);
  });

  it("sin fechas de pago o de revocación no se puede resolver", () => {
    expect(run({}, { paidAt: null }).ok).toBe(false);
    expect(run({}, { revokedAt: null }).ok).toBe(false);
  });
});

describe("evaluateRevocationResolution — reintegrar", () => {
  it("arma el parche: fee refunded, monto completo, medio, referencia y fecha", () => {
    const r = run({ studentMessage: "  Listo, ya te transferimos.  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.decision).toBe("refunded");
    expect(r.window).toMatchObject({ withinWindow: true, dayNumber: 1 });
    expect(r.patch).toMatchObject({
      status: "refunded",
      revocation_resolution: "refunded",
      revocation_resolved_by: "admin-1",
      revocation_resolved_at: NOW.toISOString(),
      revocation_internal_reason: "Dentro de plazo y sin indicios de bypass.",
      revocation_student_message: "Listo, ya te transferimos.",
      refund_amount_ars: 67000,
      refund_method: "bank_transfer",
      refund_reference: "OP-123456",
    });
    expect(buenosAiresDateString(r.patch.refunded_at as string)).toBe("2026-10-24");
  });

  it("exige confirmar el monto exacto del fee", () => {
    expect(run({ confirmRefundAmountArs: null })).toMatchObject({ ok: false, error: expect.stringMatching(/monto completo/i) });
    expect(run({ confirmRefundAmountArs: 66999 }).ok).toBe(false);
    expect(run({ confirmRefundAmountArs: Number.NaN }).ok).toBe(false);
  });

  it("exige medio válido y referencia de 3 a 120 caracteres", () => {
    expect(run({ refundMethod: null }).ok).toBe(false);
    expect(run({ refundMethod: "cheque" }).ok).toBe(false);
    expect(run({ refundReference: "ab" }).ok).toBe(false);
    expect(run({ refundReference: "x".repeat(121) }).ok).toBe(false);
    expect(run({ refundMethod: "digital_wallet", refundReference: "abc" }).ok).toBe(true);
  });

  it("la fecha del reintegro no puede ser inválida, futura ni anterior al pago", () => {
    expect(run({ refundedOn: null }).ok).toBe(false);
    expect(run({ refundedOn: "24/10/2026" }).ok).toBe(false);
    expect(run({ refundedOn: "2026-02-30" }).ok).toBe(false);
    expect(run({ refundedOn: "2026-10-25" })).toMatchObject({ ok: false, error: expect.stringMatching(/futura/i) });
    expect(run({ refundedOn: "2026-10-19" })).toMatchObject({ ok: false, error: expect.stringMatching(/anterior/i) });
    expect(run({ refundedOn: "2026-10-20" }).ok).toBe(true);
  });

  it("reintegrar no exige causa justificada ni confirmar denegación", () => {
    expect(run({ justifiedCause: false, confirmDenial: false }).ok).toBe(true);
  });
});

describe("evaluateRevocationResolution — denegar", () => {
  it("dentro de los 10 días exige causa justificada además del motivo", () => {
    expect(run({ ...denyInput, justifiedCause: false })).toMatchObject({ ok: false, error: expect.stringMatching(/causa justificada/i) });
    const r = run(denyInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch).toMatchObject({ revocation_resolution: "denied", revocation_student_message: "Detectamos un acuerdo por fuera de EstuRed." });
    // Denegar no toca el fee ni escribe datos de reintegro.
    expect(r.patch).not.toHaveProperty("status");
    expect(r.patch).not.toHaveProperty("refund_amount_ars");
    expect(r.patch).not.toHaveProperty("refunded_at");
  });

  it("fuera de los 10 días no exige causa justificada", () => {
    const late = { revokedAt: "2026-11-02T12:00:00.000Z" }; // 13 días después del pago
    const r = run({ ...denyInput, justifiedCause: false }, late);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.window.withinWindow).toBe(false);
  });

  it("exige confirmar la denegación (es irreversible desde la plataforma)", () => {
    expect(run({ ...denyInput, confirmDenial: false })).toMatchObject({ ok: false, error: expect.stringMatching(/Confirmá/) });
  });

  it("también valida el motivo", () => {
    expect(run({ ...denyInput, internalReason: "no" }).ok).toBe(false);
  });

  it("fee pagado en USD: reintegrar exige el reconocimiento; denegar no", () => {
    expect(run({}, { paymentCurrency: "USD" })).toMatchObject({ ok: false, error: expect.stringMatching(/USD/) });
    expect(run({ acknowledgeUsdRefund: true }, { paymentCurrency: "USD" }).ok).toBe(true);
    expect(run({}, { paymentCurrency: "ARS" }).ok).toBe(true);
    expect(run(denyInput, { paymentCurrency: "USD" }).ok).toBe(true);
  });
});
