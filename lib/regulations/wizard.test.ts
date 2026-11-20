import { describe, expect, it } from "vitest";
import { MODEL_ARTICLES } from "@/lib/regulations/modelTemplate";
import { assembleWizardText, baseArticleBody, wizardSections } from "@/lib/regulations/wizard";

describe("asistente del reglamento", () => {
  it("agrupa el modelo en secciones sin perder artículos", () => {
    const sections = wizardSections();
    expect(sections.reduce((n, s) => n + s.articles.length, 0)).toBe(MODEL_ARTICLES.length);
    expect(sections[0].name).toBe("Objeto y principios");
  });
  it("completa el nombre de la residencia", () => {
    expect(baseArticleBody(MODEL_ARTICLES[0], "Casa Norte")).toContain("Casa Norte");
    expect(baseArticleBody(MODEL_ARTICLES[0], "")).toContain("{nombre_residencia}");
  });
  it("renumera de corrido y arregla referencias", () => {
    const choices = MODEL_ARTICLES.map((a) => ({ n: a.n, included: a.n === 2 || a.n === 5, body: a.body }));
    const text = assembleWizardText(choices);
    expect(text).toContain("Art. 1. Principios de convivencia");
    expect(text).toContain("Art. 2. Edad de los residentes");
    expect(text).not.toContain("Art. 5.");
  });
  it("sin artículos incluidos devuelve texto vacío", () => {
    expect(assembleWizardText(MODEL_ARTICLES.map((a) => ({ n: a.n, included: false, body: a.body })))).toBe("");
  });
});

import { fieldDef, fillFields, pendingFields, sanitizeFieldValues } from "@/lib/regulations/fields";
import { findPlaceholders } from "@/lib/regulations/modelTemplate";

describe("campos del asistente (opción múltiple)", () => {
  it("lista los campos pendientes sin el nombre de la residencia", () => {
    expect(pendingFields("Edad entre {edad_minima} y {edad_maxima} en {nombre_residencia}; {edad_minima}")).toEqual(["edad_minima", "edad_maxima"]);
  });
  it("reemplaza solo los campos con valor", () => {
    const out = fillFields("Silencio desde {hora_silencio}, cierre {hora_cierre}.", { hora_silencio: "22:00", hora_cierre: "  " });
    expect(out).toBe("Silencio desde 22:00, cierre {hora_cierre}.");
  });
  it("completar todos los campos de un artículo deja el texto publicable", () => {
    const a = MODEL_ARTICLES.find((x) => x.n === 5)!;
    const out = fillFields(baseArticleBody(a, "Casa Norte"), { edad_minima: "18", edad_maxima: "30" });
    expect(findPlaceholders(out)).toEqual([]);
  });
  it("define opciones fijas para moneda y texto libre para el resto", () => {
    expect(fieldDef("moneda_cobro")).toMatchObject({ kind: "select", options: ["USD", "ARS"] });
    expect(fieldDef("texto_propio_de_valores")).toMatchObject({ kind: "text", label: "texto propio de valores" });
  });
  it("todo campo con opciones tiene al menos dos", () => {
    for (const a of MODEL_ARTICLES) for (const f of pendingFields(a.body)) {
      const d = fieldDef(f);
      if (d.kind === "select") expect(d.options!.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("sanea valores del borrador", () => {
    expect(sanitizeFieldValues({ a: "x", "b c": "y", d: 3 })).toEqual({ a: "x" });
    expect(sanitizeFieldValues(null)).toEqual({});
  });
});
