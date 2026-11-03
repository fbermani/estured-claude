import { describe, expect, it } from "vitest";
import { computeGuardianExpiry, guardianNeedsReminder, isGuardianConfirmationExpired, GUARDIAN_COPY } from "@/lib/residents/guardianConfirmationRules";

const t0 = new Date("2026-11-02T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const row = (over = {}) => ({ status: "pending", requested_at: t0.toISOString(), expires_at: computeGuardianExpiry(t0).toISOString(), reminded_at: null, ...over });

describe("reglas de la confirmación del tutor", () => {
  it("vence a los 7 días exactos", () => {
    expect(isGuardianConfirmationExpired(row(), new Date(t0.getTime() + 6 * DAY))).toBe(false);
    expect(isGuardianConfirmationExpired(row(), new Date(t0.getTime() + 7 * DAY))).toBe(true);
    expect(isGuardianConfirmationExpired(row({ status: "confirmed" }), new Date(t0.getTime() + 9 * DAY))).toBe(false);
  });
  it("recordatorio desde el día 3, una vez y solo si sigue vigente", () => {
    expect(guardianNeedsReminder(row(), new Date(t0.getTime() + 2 * DAY))).toBe(false);
    expect(guardianNeedsReminder(row(), new Date(t0.getTime() + 3 * DAY))).toBe(true);
    expect(guardianNeedsReminder(row({ reminded_at: t0.toISOString() }), new Date(t0.getTime() + 4 * DAY))).toBe(false);
    expect(guardianNeedsReminder(row(), new Date(t0.getTime() + 8 * DAY))).toBe(false);
  });
  it("el copy no promete disponibilidad ni habla de mediación", () => {
    const all = JSON.stringify(Object.values(GUARDIAN_COPY).map((f) => (f as (...a: string[]) => unknown)("Valentina G.", "Casa Sur")));
    expect(all).not.toMatch(/mediaci|garantiz|reserva garantizada|disponib/i);
  });
});
