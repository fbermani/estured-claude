import { describe, expect, it } from "vitest";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import { abbreviateUniversity, joinUniversityNames } from "./universityLabel";

describe("abbreviateUniversity", () => {
  it("las sedes de la UBA quedan como «UBA» + especialidad, sin «Facultad de»", () => {
    expect(abbreviateUniversity("UBA - Facultad de Derecho")).toBe("UBA Derecho");
    expect(abbreviateUniversity("UBA - Facultad de Ciencias Económicas")).toBe("UBA Ciencias Económicas");
    expect(abbreviateUniversity("UBA - Facultad de Filosofía y Letras")).toBe("UBA Filosofía y Letras");
    expect(abbreviateUniversity("UBA - Ciudad Universitaria")).toBe("UBA Ciudad Universitaria");
  });
  it("usa la sigla de la UBA cuando la tiene", () => {
    expect(abbreviateUniversity("UBA - Facultad de Arquitectura, Diseño y Urbanismo (FADU)")).toBe("UBA FADU");
  });
  it("usa la sigla entre paréntesis en las demás universidades", () => {
    expect(abbreviateUniversity("Universidad Católica Argentina (UCA)")).toBe("UCA");
    expect(abbreviateUniversity("Universidad Tecnológica Nacional (UTN - FRBA)")).toBe("UTN FRBA");
    expect(abbreviateUniversity("Universidad Nacional de las Artes (UNA)")).toBe("UNA");
  });
  it("sin sigla abrevia Universidad, Facultad, Nacional, Instituto y Universitario", () => {
    expect(abbreviateUniversity("Universidad de Belgrano")).toBe("U. de Belgrano");
    expect(abbreviateUniversity("Instituto Universitario del Hospital Italiano")).toBe("Inst. Univ. del Hospital Italiano");
    expect(abbreviateUniversity("UADE")).toBe("UADE");
    expect(abbreviateUniversity("Universidad Nacional de Lanús")).toBe("U. Nac. de Lanús");
  });
  it("ninguna universidad del catálogo queda más larga que su nombre completo ni vacía", () => {
    for (const n of UNIVERSITY_NAMES) {
      const short = abbreviateUniversity(n);
      expect(short.length).toBeGreaterThan(0);
      expect(short.length).toBeLessThanOrEqual(n.length);
      expect(short).not.toMatch(/Facultad de|Universidad /);
    }
  });
  it("joinUniversityNames une con coma y «y»", () => {
    expect(joinUniversityNames(["UBA - Facultad de Derecho", "Universidad de Palermo (UP)", "UADE"])).toBe("UBA Derecho, UP y UADE");
    expect(joinUniversityNames([])).toBe("");
  });
});
