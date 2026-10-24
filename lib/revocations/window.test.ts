import { describe, expect, it } from "vitest";
import {
  REVOCATION_WINDOW_DAYS,
  computeRevocationWindow,
  isRevocationWindowOpen,
  pendingAgeDays,
  revocationDaysRemaining,
  describeRevocationDay,
} from "@/lib/revocations/window";

const PAID = "2026-10-10T15:00:00.000Z";
const at = (days: number) => new Date(new Date(PAID).getTime() + days * 24 * 3_600_000);

describe("computeRevocationWindow (10 días corridos desde paid_at)", () => {
  it("el mismo día es el día 1 de 10 y está dentro de plazo", () => {
    const w = computeRevocationWindow(PAID, at(0.2));
    expect(w).toMatchObject({ withinWindow: true, dayNumber: 1, daysElapsed: 0 });
    expect(w.deadline.toISOString()).toBe(at(10).toISOString());
  });

  it("a los 9 días y 23 horas sigue dentro (día 10 de 10)", () => {
    const w = computeRevocationWindow(PAID, at(9.95));
    expect(w).toMatchObject({ withinWindow: true, dayNumber: 10, daysElapsed: 9 });
  });

  it("a los 10 días exactos ya está fuera (mismo criterio que el servidor del estudiante: >= 10 bloquea)", () => {
    expect(computeRevocationWindow(PAID, at(10)).withinWindow).toBe(false);
    expect(computeRevocationWindow(PAID, at(11.5))).toMatchObject({ withinWindow: false, dayNumber: 12 });
  });

  it("se mide hasta la revocación, no hasta ahora: resolver tarde no cambia el resultado", () => {
    const revokedAt = at(3);
    const w = computeRevocationWindow(PAID, revokedAt);
    expect(w.withinWindow).toBe(true);
    // 30 días después el cálculo del plazo del estudiante diría "vencido", pero la revocación ya estaba dentro.
    expect(isRevocationWindowOpen(PAID, at(30))).toBe(false);
  });
});

describe("helpers de plazo", () => {
  it("días restantes: redondea hacia arriba y no baja de 0", () => {
    expect(revocationDaysRemaining(PAID, at(0))).toBe(REVOCATION_WINDOW_DAYS);
    expect(revocationDaysRemaining(PAID, at(8.5))).toBe(2);
    expect(revocationDaysRemaining(PAID, at(9.99))).toBe(1);
    expect(revocationDaysRemaining(PAID, at(40))).toBe(0);
  });

  it("antigüedad en días enteros", () => {
    expect(pendingAgeDays(PAID, at(0.5))).toBe(0);
    expect(pendingAgeDays(PAID, at(4.2))).toBe(4);
    expect(pendingAgeDays(at(5), PAID)).toBe(0);
  });
});

describe("describeRevocationDay", () => {
  it("dentro de plazo dice 'día N de 10'; fuera, 'fuera de plazo (día N)' sin 'de 10'", () => {
    expect(describeRevocationDay({ withinWindow: true, dayNumber: 3 })).toBe("día 3 de 10");
    expect(describeRevocationDay({ withinWindow: false, dayNumber: 12 })).toBe("fuera de plazo (día 12)");
  });
});
