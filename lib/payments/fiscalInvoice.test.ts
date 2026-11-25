import { describe, expect, it } from "vitest";
import { normalizeFacturaCNumber, validateInvoiceDate } from "@/lib/payments/fiscalInvoice";

describe("Factura C manual (LEG-002)", () => {
  it("normaliza punto de venta y número", () => {
    expect(normalizeFacturaCNumber("1-123")).toEqual({ ok: true, value: "00001-00000123" });
    expect(normalizeFacturaCNumber(" 00002 - 00000045 ")).toEqual({ ok: true, value: "00002-00000045" });
  });

  it("rechaza formatos inválidos y ceros", () => {
    for (const bad of ["", "123", "a-1", "123456-1", "1-123456789", "0-1", "1-0", null]) {
      expect(normalizeFacturaCNumber(bad).ok).toBe(false);
    }
  });

  it("la fecha no puede ser futura ni anterior al pago", () => {
    const now = new Date("2026-11-25T15:00:00Z");
    expect(validateInvoiceDate("2026-11-24", "2026-11-20T15:00:00Z", now)).toEqual({ ok: true, value: "2026-11-24" });
    expect(validateInvoiceDate("2026-11-26", null, now).ok).toBe(false);
    expect(validateInvoiceDate("2026-11-19", "2026-11-20T15:00:00Z", now).ok).toBe(false);
    expect(validateInvoiceDate("x", null, now).ok).toBe(false);
  });
});
