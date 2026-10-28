import { describe, expect, it } from "vitest";
import { validateTopRules } from "@/lib/residences/topRules";

describe("validateTopRules", () => {
  it("normaliza y descarta vacías y repetidas", () => {
    expect(validateTopRules("Silencio 22hs\n\n  silencio 22hs \nSin fumar")).toEqual({ ok: true, items: ["Silencio 22hs", "Sin fumar"] });
  });
  it("rechaza más de 5, enlaces y reglas largas", () => {
    expect(validateTopRules("a1\nb2\nc3\nd4\ne5\nf6").ok).toBe(false);
    expect(validateTopRules("Mirá www.sitio.com").ok).toBe(false);
    expect(validateTopRules("x".repeat(121)).ok).toBe(false);
  });
});
