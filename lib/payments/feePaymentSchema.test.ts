import { describe, expect, it } from "vitest";
import { isMissingFeeAuditColumnError } from "@/lib/payments/feePaymentSchema";

describe("isMissingFeeAuditColumnError (migración 0050 sin aplicar)", () => {
  it("reconoce la columna faltante por código y nombre", () => {
    expect(isMissingFeeAuditColumnError({ code: "PGRST204", message: "Could not find the 'received_amount' column of 'estured_fee_payments' in the schema cache" })).toBe(true);
    expect(isMissingFeeAuditColumnError({ code: "42703", message: 'column "confirmed_without_receipt" of relation "estured_fee_payments" does not exist' })).toBe(true);
    expect(isMissingFeeAuditColumnError({ code: null, message: 'column "validated_by_user_id" does not exist' })).toBe(true);
  });
  it("no confunde otros errores con la migración pendiente", () => {
    expect(isMissingFeeAuditColumnError(null)).toBe(false);
    expect(isMissingFeeAuditColumnError({ code: "XX000", message: "boom" })).toBe(false);
    // falta otra columna/tabla (no las de la 0050)
    expect(isMissingFeeAuditColumnError({ code: "42703", message: 'column "otra_cosa" does not exist' })).toBe(false);
    expect(isMissingFeeAuditColumnError({ code: "42P01", message: 'relation "estured_fee_payments" does not exist' })).toBe(false);
    // menciona la columna pero es otro tipo de error (permisos / constraint)
    expect(isMissingFeeAuditColumnError({ code: "42501", message: "permission denied for column received_amount" })).toBe(false);
    expect(isMissingFeeAuditColumnError({ code: "23514", message: 'violates check constraint "estured_fee_payments_received_amount_check"' })).toBe(false);
  });
});
