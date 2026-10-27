import { describe, expect, it } from "vitest";
import { CABA_BARRIOS, isCabaBarrio } from "@/lib/data/caBarrios";

describe("CABA_BARRIOS", () => {
  it("tiene los 48 barrios oficiales sin repetidos", () => {
    expect(CABA_BARRIOS).toHaveLength(48);
    expect(new Set(CABA_BARRIOS).size).toBe(48);
  });

  it("valida solo barrios exactos", () => {
    expect(isCabaBarrio("Palermo")).toBe(true);
    expect(isCabaBarrio("Villa Urquiza")).toBe(true);
    expect(isCabaBarrio("Centro")).toBe(false);
    expect(isCabaBarrio("Otra")).toBe(false);
    expect(isCabaBarrio("palermo")).toBe(false);
    expect(isCabaBarrio(undefined)).toBe(false);
  });
});
