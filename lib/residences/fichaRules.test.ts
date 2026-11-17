import { describe, expect, it } from "vitest";
import { RULES_VISIBLE, canDownloadRegulation, moreRulesLabel, parseRuleLines, splitRuleLine, ruleLead, splitRules } from "@/lib/residences/fichaRules";

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

describe("splitRuleLine", () => {
  it("separa «Título: detalle»", () => {
    expect(splitRuleLine("Silencio: de 23 a 7, para música o videos, auriculares")).toEqual({
      title: "Silencio",
      body: "de 23 a 7, para música o videos, auriculares",
    });
  });
  it("sin dos puntos la regla entera es el cuerpo", () => {
    expect(splitRuleLine("No se admiten mascotas")).toEqual({ title: null, body: "No se admiten mascotas" });
  });
  it("un título largo o sin detalle no se parte (no se pierde texto)", () => {
    const long = "Esto es una frase larguísima que contiene: dos puntos más adelante";
    expect(splitRuleLine(long)).toEqual({ title: null, body: long });
    expect(splitRuleLine("Visitas:")).toEqual({ title: null, body: "Visitas:" });
  });
  it("una dirección web no se parte", () => {
    expect(splitRuleLine("https://ejemplo.com/reglas").title).toBeNull();
  });
});

describe("ruleLead (columna izquierda, solo se lee del texto)", () => {
  it("rango horario: «23 a 7»", () => {
    expect(ruleLead("Silencio: de 23 a 7, para música o videos, auriculares")).toBe("23 a 7");
    expect(ruleLead("Cocina abierta: de 7 a 23")).toBe("7 a 23");
    expect(ruleLead("Silencio: de 23:00 a 7:00 hs")).toBe("23 a 7");
    expect(ruleLead("Visitas hasta las 22:30 a 23:30")).toBe("22:30 a 23:30");
  });
  it("«de 2 a 4 personas» no es un horario", () => {
    expect(ruleLead("Visitas: de 2 a 4 personas por vez")).toBeNull();
    expect(ruleLead("Estadía de 3 a 6 meses")).toBeNull();
    expect(ruleLead("Entre 10 a 99 reglas")).toBeNull();
  });
  it("prohibición: «No»", () => {
    expect(ruleLead("No se admiten mascotas")).toBe("No");
    expect(ruleLead("Mascotas: No se admiten, por convivencia")).toBe("No");
    expect(ruleLead("Visitas: no pueden quedarse a dormir")).toBeNull();
  });
  it("«Libre» y «Sí»", () => {
    expect(ruleLead("Entrada y salida: libre, con tu llave")).toBe("Libre");
    expect(ruleLead("Ambiente libre de humo")).toBeNull();
    expect(ruleLead("Visitas: Sí, en los espacios comunes")).toBe("Sí");
    expect(ruleLead("Si tenés visitas, avisá")).toBeNull();
  });
  it("sin forma reconocible no se inventa nada", () => {
    expect(ruleLead("Cada uno lava y guarda lo que usa")).toBeNull();
  });
});
