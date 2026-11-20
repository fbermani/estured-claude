import { describe, expect, it } from "vitest";
import { computeProfileStrength, profileStrengthSuggestion, strengthFromReadiness, type ProfileStrengthInput } from "./profileStrength";
import { computeSubmitReadiness, type SubmitReadinessInput } from "./submitReadiness";

const full: ProfileStrengthInput = {
  tagline: "Casa",
  description: "Una descripción de más de veinte caracteres.",
  services: 2,
  commonAreas: 1,
  rulesSummary: "Reglas",
  nearUniversities: 1,
  photos: 3,
  roomTypesOk: true,
};

describe("computeProfileStrength", () => {
  it("100% con todo completo y sin sugerencia", () => {
    const s = computeProfileStrength(full);
    expect(s.percent).toBe(100);
    expect(profileStrengthSuggestion(s)).toBeNull();
  });

  it("sin fotos no llega a 80% aunque lo demás esté completo", () => {
    const s = computeProfileStrength({ ...full, photos: 0 });
    expect(s.percent).toBe(75);
    expect(s.photosMissing).toBe(3);
    expect(profileStrengthSuggestion(s)).toContain("todavía no hay ninguna");
  });

  it("las fotos suman de forma proporcional", () => {
    expect(computeProfileStrength({ ...full, photos: 1 }).percent).toBe(83);
    expect(computeProfileStrength({ ...full, photos: 2 }).percent).toBe(92);
    expect(computeProfileStrength({ ...full, photos: 9 }).percent).toBe(100);
  });

  it("la sugerencia nombra lo que falta de verdad", () => {
    const s = computeProfileStrength({ ...full, photos: 2, tagline: "", services: 0 });
    const text = profileStrengthSuggestion(s) ?? "";
    expect(text).toContain("1 foto más");
    expect(text).toContain("el eslogan y los servicios");
  });

  it("con las 3 fotos no pide fotos", () => {
    const text = profileStrengthSuggestion(computeProfileStrength({ ...full, rulesSummary: "" })) ?? "";
    expect(text).not.toContain("foto");
    expect(text).toContain("las reglas de convivencia");
  });
});

describe("strengthFromReadiness (fortaleza derivada de los requisitos para enviar)", () => {
  const ready: SubmitReadinessInput = {
    residenceId: "res-1",
    name: "Casa",
    zone: "Palermo",
    addressLine: "Calle 1",
    tagline: "Casa",
    description: "Una descripción de más de veinte caracteres.",
    services: 1,
    commonAreas: 1,
    rulesSummary: "Reglas",
    nearUniversities: 2,
    roomTypesCount: 1,
    roomTypesPriced: true,
    photos: 3,
    regulationPublished: true,
    rulesPdf: false,
    essentialFaqsReady: 3,
    conditions: {
      adjustmentPolicy: "quarterly",
      initialPaymentMode: "one_month",
      initialPaymentUsd: "",
      enrollmentEnabled: false,
      enrollmentFeeMode: null,
      enrollmentFeeUsd: "",
      depositEnabled: false,
      depositMode: "",
      depositUsd: "",
      emptyMonthsEnabled: false,
      emptyMonthChargePercent: "",
      earlyExitCostsText: "",
      earlyExitConditionsText: "",
    },
  };

  it("100% solo con todos los requisitos cumplidos", () => {
    const s = strengthFromReadiness(computeSubmitReadiness(ready));
    expect(s.percent).toBe(100);
    expect(s.gaps).toEqual([]);
    expect(s.photosMissing).toBe(0);
  });

  it("nunca muestra 100% si falta algo, aunque sea un avance parcial", () => {
    const s = strengthFromReadiness(computeSubmitReadiness({ ...ready, photos: 2 }));
    expect(s.percent).toBeLessThan(100);
    expect(s.photosMissing).toBe(1);
    expect(profileStrengthSuggestion(s)).toContain("1 foto más");
  });

  it("los requisitos parciales suman en proporción y los faltantes aparecen como brechas", () => {
    const none = strengthFromReadiness(computeSubmitReadiness({ ...ready, essentialFaqsReady: 0, services: 0 }));
    const some = strengthFromReadiness(computeSubmitReadiness({ ...ready, essentialFaqsReady: 2, services: 0 }));
    expect(some.percent).toBeGreaterThan(none.percent);
    expect(none.gaps.map((g) => g.key)).toEqual(["services", "faq"]);
  });
});
