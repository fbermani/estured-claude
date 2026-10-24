import { describe, expect, it } from "vitest";
import { computeProfileStrength, profileStrengthSuggestion, type ProfileStrengthInput } from "./profileStrength";

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
