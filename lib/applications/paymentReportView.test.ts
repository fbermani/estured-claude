import { describe, expect, it } from "vitest";
import {
  buildPaymentReportView,
  isPaymentClosedForStudent,
  isPaymentIssueOpen,
  paymentHoldsDeadline,
  validateDisputeReason,
  validateIssueReason,
} from "@/lib/applications/paymentReportView";

describe("paymentHoldsDeadline: se decide por fechas, no por estado", () => {
  it("sin avisos no frena el vencimiento", () => {
    expect(paymentHoldsDeadline({ status: "pending" })).toBe(false);
    expect(paymentHoldsDeadline({ status: "student_reference_uploaded" })).toBe(false);
  });
  it("«Ya pagué» frena, incluso si la residencia después lo disputó", () => {
    expect(paymentHoldsDeadline({ status: "student_reported_paid", student_reported_paid_at: "2026-11-20T10:00:00Z" })).toBe(true);
    expect(paymentHoldsDeadline({ status: "disputed", student_reported_paid_at: "2026-11-20T10:00:00Z" })).toBe(true);
  });
  it("un aviso de problema abierto frena; resuelto no", () => {
    expect(paymentHoldsDeadline({ status: "pending", student_payment_issue_at: "2026-11-20T10:00:00Z" })).toBe(true);
    expect(
      paymentHoldsDeadline({ status: "pending", student_payment_issue_at: "2026-11-20T10:00:00Z", student_payment_issue_resolved_at: "2026-11-20T12:00:00Z" }),
    ).toBe(false);
  });
});

describe("estados y validaciones", () => {
  it("isPaymentIssueOpen", () => {
    expect(isPaymentIssueOpen({ student_payment_issue_at: null, student_payment_issue_resolved_at: null })).toBe(false);
    expect(isPaymentIssueOpen({ student_payment_issue_at: "x", student_payment_issue_resolved_at: null })).toBe(true);
    expect(isPaymentIssueOpen({ student_payment_issue_at: "x", student_payment_issue_resolved_at: "y" })).toBe(false);
  });
  it("isPaymentClosedForStudent", () => {
    for (const s of ["reported_received_by_residence", "expired", "disputed"]) expect(isPaymentClosedForStudent(s)).toBe(true);
    for (const s of ["pending", "student_reported_paid", "student_reference_uploaded"]) expect(isPaymentClosedForStudent(s)).toBe(false);
  });
  it("motivo opcional de «No pude»: vacío ok; si se escribe, 10 a 200", () => {
    expect(validateIssueReason("")).toEqual({ ok: true, value: null });
    expect(validateIssueReason(null)).toEqual({ ok: true, value: null });
    expect(validateIssueReason("corto").ok).toBe(false);
    expect(validateIssueReason("  no me anduvo la app  ")).toEqual({ ok: true, value: "no me anduvo la app" });
    expect(validateIssueReason("x".repeat(201)).ok).toBe(false);
  });
  it("motivo obligatorio de «No recibí»: 10 a 300", () => {
    expect(validateDisputeReason("").ok).toBe(false);
    expect(validateDisputeReason("123456789").ok).toBe(false);
    expect(validateDisputeReason("no figura en mi cuenta")).toEqual({ ok: true, value: "no figura en mi cuenta" });
    expect(validateDisputeReason("x".repeat(301)).ok).toBe(false);
  });
});

describe("buildPaymentReportView", () => {
  it("null si el estudiante no avisó nada", () => {
    expect(buildPaymentReportView({ status: "pending" })).toBeNull();
    expect(buildPaymentReportView(null)).toBeNull();
  });
  it("«Ya pagué» con comprobante y montos como número", () => {
    const v = buildPaymentReportView({
      status: "student_reported_paid",
      student_reported_paid_at: "2026-11-20T10:00:00Z",
      student_proof_file_id: "f1",
      amount_reported_usd: "300.00",
    });
    expect(v).toMatchObject({ reportedPaidAt: "2026-11-20T10:00:00Z", hasProof: true, reportedAmountUsd: 300, reportedAmountArs: null, issueOpen: false });
  });
  it("aviso abierto lleva fecha y motivo; resuelto, no", () => {
    expect(buildPaymentReportView({ status: "pending", student_payment_issue_at: "t", student_payment_issue_reason: "no pude" })).toMatchObject({
      issueOpen: true,
      issueAt: "t",
      issueReason: "no pude",
    });
    expect(buildPaymentReportView({ status: "pending", student_payment_issue_at: "t", student_payment_issue_resolved_at: "u" })).toBeNull();
  });
  it("disputa con motivo", () => {
    expect(buildPaymentReportView({ status: "disputed", student_reported_paid_at: "t", dispute_reason: "no llegó" })).toMatchObject({ disputed: true, disputeReason: "no llegó" });
  });
});
