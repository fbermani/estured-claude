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
