import { describe, expect, it } from "vitest";
import { buildWhatsappUrl } from "@/lib/applications/whatsapp";

const base = {
  phone: "+54 9 11 5555-1234",
  studentName: "Lucía",
  residenceName: "Casa Palermo",
  roomTypeName: "Individual",
  desiredStartDate: "2027-03-01",
  durationMonths: 6,
  reservationAmountUsd: 450,
};

function messageOf(url: string): string {
  return decodeURIComponent(url.split("?text=")[1]);
}

describe("buildWhatsappUrl", () => {
  it("apunta al número solo con dígitos", () => {
    expect(buildWhatsappUrl(base).startsWith("https://wa.me/5491155551234?text=")).toBe(true);
  });

  it("muestra el pago inicial a la residencia, sin la frase vieja 'Monto para reservar'", () => {
    const msg = messageOf(buildWhatsappUrl(base));
    expect(msg).toContain("Pago inicial para reservar: A la residencia: USD 450");
    expect(msg).not.toContain("Monto para reservar");
    expect(msg).not.toContain("antes del");
    expect(msg).not.toContain("fee");
  });

  it("agrega la fecha límite y el fee aparte cuando existen", () => {
    const msg = messageOf(
      buildWhatsappUrl({ ...base, paymentDeadlineAt: "2026-10-25T15:00:00.000Z", feeUsd: 92.5 }),
    );
    expect(msg).toContain("A la residencia: USD 450 antes del 25/10/2026 · A EstuRed: fee USD 92,5");
  });
});
