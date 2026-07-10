import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReceiptPdfDocument, type ReceiptPdfPayload } from "@/lib/receipts/ReceiptPdfDocument";

/**
 * Smoke test del render server-side (no hay `supabase start` local para
 * un test de integración real de la ruta — ver GAPS.md). Cubre lo que
 * más riesgo de romperse en silencio tiene: que el documento efectivamente
 * produzca bytes de PDF válidos con datos reales de `receipt_payload`.
 */
describe("ReceiptPdfDocument", () => {
  const payload: ReceiptPdfPayload = {
    student: { first_name: "Lucía", last_initial: "F." },
    residence: { name: "Residencia Norte", public_area: "Palermo" },
    room_type: "Individual",
    desired_start_date: "2026-08-15",
    initial_duration_months: 6,
    academic_objective: "Estudiar Medicina en la UBA.",
    final_conditions: { monthly_price_usd: 300, enrollment_fee_usd: 50, deposit_usd: 300 },
    estured_fee: { amount_ars: 140500, currency: "ARS", paid_at: "2026-07-09T12:00:00.000Z" },
    adjustment_policy: "quarterly",
    disclaimer: "EstuRed es una plataforma intermediaria.",
  };

  it("genera un buffer PDF válido y no vacío", async () => {
    const buffer = await renderToBuffer(
      ReceiptPdfDocument({
        receiptNumber: "ER-2026-ABC123",
        status: "issued",
        issuedAt: "2026-07-09T12:00:00.000Z",
        payload,
        qrDataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        verificationUrl: "https://estured.vercel.app/verify/00000000-0000-0000-0000-000000000000",
      }),
    );

    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
