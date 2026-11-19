import { describe, expect, it } from "vitest";
import { MAX_REGULATION_LENGTH } from "@/lib/regulations/limits";
import { sanitizeRegulationDraft, sanitizeWizardDraft } from "@/lib/regulations/draft";

describe("sanitizeRegulationDraft", () => {
  it("acepta texto y origen válidos", () => {
    expect(sanitizeRegulationDraft({ text: "Art. 1. Respeto.", source: "model" })).toEqual({ text: "Art. 1. Respeto.", source: "model" });
  });
  it("un origen desconocido se toma como reglamento propio", () => {
    expect(sanitizeRegulationDraft({ text: "x", source: "otro" })?.source).toBe("own");
  });
  it("rechaza lo que no tiene texto", () => {
    expect(sanitizeRegulationDraft(null)).toBeNull();
    expect(sanitizeRegulationDraft([])).toBeNull();
    expect(sanitizeRegulationDraft({ text: 5 })).toBeNull();
    expect(sanitizeRegulationDraft("texto")).toBeNull();
  });
  it("acota el largo al máximo del reglamento", () => {
    const r = sanitizeRegulationDraft({ text: "a".repeat(MAX_REGULATION_LENGTH + 500), source: "own" });
    expect(r?.text.length).toBe(MAX_REGULATION_LENGTH);
  });
});

describe("sanitizeWizardDraft", () => {
  const articles = [1, 2, 3];
  it("conserva elecciones válidas y acota el paso", () => {
    const r = sanitizeWizardDraft({ step: 99, choices: { "1": { included: true, body: "uno" }, "2": { included: false, body: "dos" } } }, articles, 4);
    expect(r).toEqual({ step: 3, choices: { 1: { included: true, body: "uno" }, 2: { included: false, body: "dos" } } });
  });
  it("ignora artículos que no existen y elecciones mal formadas", () => {
    const r = sanitizeWizardDraft({ step: 0, choices: { "9": { included: true, body: "x" }, "1": { included: "si", body: "x" }, "2": null, "3": { included: true, body: "tres" } } }, articles, 2);
    expect(r?.choices).toEqual({ 3: { included: true, body: "tres" } });
  });
  it("sin elecciones válidas devuelve null; un paso inválido vale 0", () => {
    expect(sanitizeWizardDraft({ step: 1, choices: {} }, articles, 2)).toBeNull();
    expect(sanitizeWizardDraft({ choices: "no" }, articles, 2)).toBeNull();
    expect(sanitizeWizardDraft(undefined, articles, 2)).toBeNull();
    expect(sanitizeWizardDraft({ step: -3, choices: { "1": { included: true, body: "a" } } }, articles, 2)?.step).toBe(0);
    expect(sanitizeWizardDraft({ step: 1.5, choices: { "1": { included: true, body: "a" } } }, articles, 2)?.step).toBe(0);
  });
});
