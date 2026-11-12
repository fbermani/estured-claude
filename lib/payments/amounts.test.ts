import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_ARS, parseOptionalAmount } from "./amounts";

describe("parseOptionalAmount", () => {
  it("vacío y 0 dan null", () => {
    expect(parseOptionalAmount("", MAX_AMOUNT_ARS, "pesos")).toEqual({ ok: true, value: null });
    expect(parseOptionalAmount(null, MAX_AMOUNT_ARS, "pesos")).toEqual({ ok: true, value: null });
    expect(parseOptionalAmount("0", MAX_AMOUNT_ARS, "pesos")).toEqual({ ok: true, value: null });
  });
  it("acepta un monto válido", () => {
    expect(parseOptionalAmount("150000.5", MAX_AMOUNT_ARS, "pesos")).toEqual({ ok: true, value: 150000.5 });
  });
  it("rechaza negativos, no finitos, texto y topes", () => {
    for (const bad of ["-1", "Infinity", "abc", "NaN", "1e12"]) {
      expect(parseOptionalAmount(bad, MAX_AMOUNT_ARS, "pesos").ok).toBe(false);
    }
  });
});
