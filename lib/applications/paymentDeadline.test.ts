import { describe, expect, it } from "vitest";
import { describePaymentDeadline, effectiveContactDeadline } from "@/lib/applications/paymentDeadline";

const NOW = new Date("2026-10-21T15:00:00.000Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

describe("describePaymentDeadline", () => {
  it("devuelve null sin plazo o con fecha inválida", () => {
    expect(describePaymentDeadline(null, NOW)).toBeNull();
    expect(describePaymentDeadline(undefined, NOW)).toBeNull();
    expect(describePaymentDeadline("no-es-fecha", NOW)).toBeNull();
  });

  it("marca el plazo pasado como vencido y urgente", () => {
    const info = describePaymentDeadline(at(-3), NOW)!;
    expect(info.relative).toBe("Plazo vencido");
    expect(info.overdue).toBe(true);
    expect(info.urgent).toBe(true);
  });

  it("menos de 1 h", () => {
    const info = describePaymentDeadline(at(0.5), NOW)!;
    expect(info.relative).toBe("Vence en menos de 1 h");
    expect(info.urgent).toBe(true);
    expect(info.overdue).toBe(false);
  });

  it("en horas hasta 48 h; urgente solo hasta 24 h", () => {
    expect(describePaymentDeadline(at(5), NOW)).toMatchObject({ relative: "Vence en 5 h", urgent: true });
    expect(describePaymentDeadline(at(24), NOW)).toMatchObject({ relative: "Vence en 24 h", urgent: true });
    expect(describePaymentDeadline(at(30), NOW)).toMatchObject({ relative: "Vence en 30 h", urgent: false });
  });

  it("en días a partir de 48 h", () => {
    expect(describePaymentDeadline(at(48), NOW)!.relative).toBe("Vence en 2 días");
    expect(describePaymentDeadline(at(100), NOW)!.relative).toBe("Vence en 4 días");
  });

  it("incluye la fecha absoluta en hora de Buenos Aires", () => {
    expect(describePaymentDeadline("2026-10-23T17:30:00.000Z", NOW)!.absolute).toMatch(/^23\/10\/2026,? 14:30$/);
  });
});

describe("effectiveContactDeadline", () => {
  it("usa payment_deadline_at si existe", () => {
    expect(effectiveContactDeadline("2026-10-23T10:00:00.000Z", "2026-10-20T10:00:00.000Z")).toBe("2026-10-23T10:00:00.000Z");
  });
  it("respaldo: 48 h desde contact_established_at", () => {
    expect(effectiveContactDeadline(null, "2026-10-20T10:00:00.000Z")).toBe("2026-10-22T10:00:00.000Z");
  });
  it("sin ninguno de los dos → null", () => {
    expect(effectiveContactDeadline(null, null)).toBeNull();
    expect(effectiveContactDeadline(undefined, "basura")).toBeNull();
  });
});
