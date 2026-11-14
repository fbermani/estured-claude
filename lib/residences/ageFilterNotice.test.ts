import { describe, expect, it } from "vitest";
import { ageFilterNotice } from "@/lib/residences/ageFilterNotice";

describe("ageFilterNotice (DR51)", () => {
  it("sin residencias ocultas no hay rótulo", () => {
    expect(ageFilterNotice(0, false)).toBeNull();
  });
  it("singular, plural y fecha de ingreso", () => {
    expect(ageFilterNotice(1, false)).toBe("Mostramos las residencias que aceptan tu edad. 1 más tiene otro rango de edad.");
    expect(ageFilterNotice(3, true)).toContain("a la fecha de ingreso elegida. 3 más tienen otro rango de edad.");
  });
});
