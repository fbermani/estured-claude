import { describe, expect, it } from "vitest";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import { nearestUniversityNames } from "@/lib/residences/nearestUniversities";

const loc = { lat: -34.6, lng: -58.4 };

describe("nearestUniversityNames", () => {
  it("devuelve como máximo 3", () => {
    expect(nearestUniversityNames(UNIVERSITY_NAMES.slice(0, 8), loc)).toHaveLength(3);
  });
  it("sin ubicación toma las primeras 3 en orden", () => {
    expect(nearestUniversityNames(["A", "B", "C", "D"], null)).toEqual(["A", "B", "C"]);
  });
  it("nombres desconocidos van al final y el orden es estable", () => {
    const known = UNIVERSITY_NAMES[0];
    expect(nearestUniversityNames(["X", "Y", known], loc, 2)).toEqual([known, "X"]);
  });
  it("ordena por cercanía", () => {
    const r = nearestUniversityNames(UNIVERSITY_NAMES, loc, 3);
    expect(nearestUniversityNames([...r].reverse(), loc, 3)).toEqual(r);
  });
  it("lista vacía", () => {
    expect(nearestUniversityNames([], loc)).toEqual([]);
  });
});
