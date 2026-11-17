import { describe, expect, it } from "vitest";
import { RULES_VISIBLE, canDownloadRegulation, moreRulesLabel, parseRuleLines, splitRules } from "@/lib/residences/fichaRules";

describe("parseRuleLines", () => {
  it("una regla por línea, sin vacías ni espacios de más", () => {
    expect(parseRuleLines("Silencio desde las 23\n\n  Visitas hasta las 22  \r\nNo fumar")).toEqual([
      "Silencio desde las 23",
      "Visitas hasta las 22",
      "No fumar",
    ]);
  });
  it("saca viñetas y numeración", () => {
    expect(parseRuleLines("- Silencio\n• Visitas\n* No fumar\n1. Mascotas\n2) Limpieza")).toEqual([
      "Silencio",
      "Visitas",
      "No fumar",
      "Mascotas",
      "Limpieza",
    ]);
  });
  it("no toca un guion o número que forma parte del texto", () => {
    expect(parseRuleLines("2 visitas por semana\n-Sin espacio")).toEqual(["2 visitas por semana", "-Sin espacio"]);
  });
  it("sin resumen no hay reglas", () => {
    expect(parseRuleLines(null)).toEqual([]);
    expect(parseRuleLines("  \n ")).toEqual([]);
  });
});

describe("splitRules", () => {
  const rules = Array.from({ length: 8 }, (_, i) => `R${i + 1}`);
  it("muestra hasta 5 y deja el resto en el desplegable, sin perder ni repetir ninguna", () => {
    const { primary, more } = splitRules(rules);
    expect(RULES_VISIBLE).toBe(5);
    expect(primary).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    expect(more).toEqual(["R6", "R7", "R8"]);
    expect([...primary, ...more]).toEqual(rules);
  });
  it("con 5 o menos no hay desplegable", () => {
    expect(splitRules(rules.slice(0, 5)).more).toEqual([]);
    expect(splitRules(rules.slice(0, 2))).toEqual({ primary: ["R1", "R2"], more: [] });
    expect(splitRules([])).toEqual({ primary: [], more: [] });
  });
  it("etiqueta del desplegable en singular y plural", () => {
    expect(moreRulesLabel(1)).toBe("Ver 1 regla más");
    expect(moreRulesLabel(3)).toBe("Ver 3 reglas más");
  });
});

describe("canDownloadRegulation", () => {
  it("con reglamento propio o adaptado se ofrece la descarga", () => {
    expect(canDownloadRegulation({ regulation: { isBaseModel: false }, hasUploadedPdf: false })).toBe(true);
  });
  it("con un PDF subido se ofrece aunque rija el modelo", () => {
    expect(canDownloadRegulation({ regulation: { isBaseModel: true }, hasUploadedPdf: true })).toBe(true);
    expect(canDownloadRegulation({ regulation: null, hasUploadedPdf: true })).toBe(true);
  });
  it("si la residencia no cargó nada propio no hay botón", () => {
    expect(canDownloadRegulation({ regulation: { isBaseModel: true }, hasUploadedPdf: false })).toBe(false);
    expect(canDownloadRegulation({ regulation: null, hasUploadedPdf: false })).toBe(false);
  });
});
