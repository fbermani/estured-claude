import { describe, expect, it } from "vitest";
import { countdownLabel, daysUntil } from "./countdown";

describe("daysUntil", () => {
  it("cuenta días enteros", () => {
    expect(daysUntil("2026-11-12", "2026-11-02")).toBe(10);
    expect(daysUntil("2026-12-01", "2026-11-30")).toBe(1);
  });
  it("hoy es 0", () => {
    expect(daysUntil("2026-11-02", "2026-11-02")).toBe(0);
  });
  it("pasado, vacío o inválido es null", () => {
    expect(daysUntil("2026-11-01", "2026-11-02")).toBeNull();
    expect(daysUntil(null, "2026-11-02")).toBeNull();
    expect(daysUntil("2026-13-40", "2026-11-02")).toBeNull();
    expect(daysUntil("hoy", "2026-11-02")).toBeNull();
  });
  it("cruza fin de año y años bisiestos", () => {
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysUntil("2028-03-01", "2028-02-28")).toBe(2);
  });
});

describe("countdownLabel", () => {
  it("usa Hoy / Mañana / N días", () => {
    expect(countdownLabel(0)).toBe("Hoy");
    expect(countdownLabel(1)).toBe("Mañana");
    expect(countdownLabel(15)).toBe("Faltan 15 días");
  });
});
