import { describe, expect, it } from "vitest";
import { BUENOS_AIRES_UNIVERSITIES, UNIVERSITY_NAMES, UNIVERSITY_OTHER_NAME, withoutOtherUniversity } from "@/lib/data/buenosAiresUniversities";
import { UNIVERSITY_LEGEND, UNIVERSITY_PINS } from "@/lib/maps/universityPins";

describe("pines de universidades", () => {
  it("cada fila de la referencia apunta a un pin que existe y los ids no se repiten", () => {
    const ids = UNIVERSITY_PINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of UNIVERSITY_LEGEND) expect(ids).toContain(row.pinId);
  });

  it("toda universidad de la lista aparece en la referencia", () => {
    const labels = UNIVERSITY_LEGEND.map((r) => r.label);
    for (const u of BUENOS_AIRES_UNIVERSITIES) expect(labels.some((l) => l === u.name || l.startsWith(`${u.name} (`))).toBe(true);
  });

  it("Ciudad Universitaria, FADU y Exactas comparten un solo pin con los tres nombres", () => {
    const cu = UNIVERSITY_PINS.find((p) => p.id === "UBA - Ciudad Universitaria");
    expect(cu?.label).toContain("FADU");
    expect(cu?.label).toContain("Ciencias Exactas y Naturales");
    expect(UNIVERSITY_PINS.some((p) => p.id.includes("FADU"))).toBe(false);
  });

  it("las facultades con más de una sede tienen un pin por sede", () => {
    expect(UNIVERSITY_PINS.filter((p) => p.id.startsWith("UBA - Facultad de Psicología")).length).toBe(2);
    expect(UNIVERSITY_PINS.filter((p) => p.id.startsWith("Universidad Nacional de las Artes (UNA)")).length).toBe(16);
  });

  it("la opción «Otra» no está en la lista de universidades pero se oculta al público", () => {
    expect(UNIVERSITY_NAMES).not.toContain(UNIVERSITY_OTHER_NAME);
    expect(withoutOtherUniversity(["UADE", UNIVERSITY_OTHER_NAME])).toEqual(["UADE"]);
  });
});
