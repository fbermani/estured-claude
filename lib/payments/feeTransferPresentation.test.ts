import { describe, expect, it } from "vitest";
import {
  describeFeeCountdown,
  formatCbu,
  formatCuit,
  reservationReference,
  feeSupportHref,
} from "@/lib/payments/feeTransferPresentation";

describe("reservationReference", () => {
  it("usa los primeros 8 caracteres del id, en mayúsculas y sin guiones", () => {
    expect(reservationReference("3f2a9c1e-7b44-4d0a-9e11-0123456789ab")).toBe("EST-3F2A9C1E");
  });
  it("encaja con el formato que acepta la pantalla de Soporte", () => {
    expect(reservationReference("abcdef01-0000-0000-0000-000000000000")).toMatch(/^EST-[0-9A-F]{8}$/);
  });
});

describe("formatCbu / formatCuit", () => {
  it("agrupa en bloques legibles y deja intacto lo que no coincide", () => {
    expect(formatCbu("0170099220000001234567")).toBe("01700992 20000001234567");
    expect(formatCbu("123")).toBe("123");
    expect(formatCuit("20123456786")).toBe("20-12345678-6");
  });
});

describe("describeFeeCountdown", () => {
  const now = new Date("2026-10-21T15:00:00Z");
  it("devuelve null sin fecha o con fecha inválida", () => {
    expect(describeFeeCountdown(null, now)).toBeNull();
    expect(describeFeeCountdown("nope", now)).toBeNull();
  });
  it("formatea días, horas y minutos restantes", () => {
    expect(describeFeeCountdown("2026-10-23T18:00:00Z", now)?.remaining).toBe("2 d 3 h");
    expect(describeFeeCountdown("2026-10-21T20:12:00Z", now)?.remaining).toBe("5 h 12 min");
    expect(describeFeeCountdown("2026-10-21T15:42:00Z", now)?.remaining).toBe("42 min");
    expect(describeFeeCountdown("2026-10-21T15:00:30Z", now)?.remaining).toBe("menos de 1 min");
  });
  it("marca urgente a 12 h o menos y vencido cuando pasó", () => {
    expect(describeFeeCountdown("2026-10-22T02:00:00Z", now)?.urgent).toBe(true);
    expect(describeFeeCountdown("2026-10-22T10:00:00Z", now)?.urgent).toBe(false);
    const expired = describeFeeCountdown("2026-10-21T14:00:00Z", now);
    expect(expired).toMatchObject({ expired: true, remaining: "Plazo vencido", urgent: true });
  });
  it("muestra la fecha absoluta en hora de Buenos Aires (UTC-3)", () => {
    expect(describeFeeCountdown("2026-10-23T18:00:00Z", now)?.absolute).toBe("23/10/2026, 15:00");
  });
});

describe("feeSupportHref", () => {
  it("lleva a Soporte con el motivo de pago del fee y la reserva, sin residencia", () => {
    const href = feeSupportHref("3f2a9c1e-7b44-4d0a-9e11-0123456789ab");
    expect(href).toBe("/students/support?motivo=pago-fee&reserva=3f2a9c1e-7b44-4d0a-9e11-0123456789ab");
    expect(href).not.toContain("residence");
  });
});
