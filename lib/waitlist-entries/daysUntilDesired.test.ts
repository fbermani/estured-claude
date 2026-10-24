import { describe, expect, it } from "vitest";
import { daysUntilDesired, describeDaysUntilDesired } from "@/lib/waitlist-entries/daysUntilDesired";

const NOW = new Date("2026-10-24T15:00:00Z"); // 12:00 en Buenos Aires

describe("daysUntilDesired", () => {
  it("cuenta días calendario", () => {
    expect(daysUntilDesired("2026-10-24", NOW)).toBe(0);
    expect(daysUntilDesired("2026-11-07", NOW)).toBe(14);
    expect(daysUntilDesired("2026-10-23", NOW)).toBe(-1);
  });
  it("usa el día de Buenos Aires aunque en UTC ya sea el día siguiente", () => {
    expect(daysUntilDesired("2026-10-24", new Date("2026-10-25T01:00:00Z"))).toBe(0);
  });
  it("devuelve null (nunca NaN) con fechas ausentes o inválidas", () => {
    expect(daysUntilDesired(null, NOW)).toBeNull();
    expect(daysUntilDesired("", NOW)).toBeNull();
    expect(daysUntilDesired("24/10/2026", NOW)).toBeNull();
    expect(daysUntilDesired("basura", NOW)).toBeNull();
  });
});

describe("describeDaysUntilDesired", () => {
  it("arma el texto", () => {
    expect(describeDaysUntilDesired(-3)).toBe("fecha vencida");
    expect(describeDaysUntilDesired(0)).toBe("hoy");
    expect(describeDaysUntilDesired(1)).toBe("en 1 día");
    expect(describeDaysUntilDesired(20)).toBe("en 20 días");
    expect(describeDaysUntilDesired(null)).toBeNull();
    expect(describeDaysUntilDesired(NaN)).toBeNull();
  });
});
