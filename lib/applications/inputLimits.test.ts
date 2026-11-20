import { describe, expect, it } from "vitest";
import { checkTextMax, isIsoDate, parseDurationMonths } from "@/lib/applications/inputLimits";

describe("inputLimits", () => {
  it("parseDurationMonths acepta enteros 1–24 y rechaza NaN, decimales, vacío y fuera de rango", () => {
    expect(parseDurationMonths("6")).toBe(6);
    expect(parseDurationMonths(" 24 ")).toBe(24);
    for (const bad of ["", "0", "25", "abc", "NaN", "1.5", "-3", "1e1", null]) {
      expect(parseDurationMonths(bad as string | null)).toBeNull();
    }
  });

  it("isIsoDate valida fechas reales del calendario", () => {
    expect(isIsoDate("2026-08-15")).toBe(true);
    for (const bad of ["", "2026-02-31", "2026-13-01", "15/08/2026", "2026-8-5", "hola"]) {
      expect(isIsoDate(bad)).toBe(false);
    }
  });

  it("checkTextMax rechaza solo lo que pasa el tope", () => {
    expect(checkTextMax("a".repeat(1000), 1000, "El texto").ok).toBe(true);
    const r = checkTextMax("a".repeat(1001), 1000, "El texto");
    expect(r.ok).toBe(false);
    expect(checkTextMax(null, 10, "El texto").ok).toBe(true);
  });
});
