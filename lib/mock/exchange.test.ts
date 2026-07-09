import { describe, expect, it } from "vitest";
import { roundArs, roundUsd, usdToArs } from "@/lib/mock/exchange";

describe("usdToArs", () => {
  it("convierte USD a ARS con la cotización dada", () => {
    expect(usdToArs(300, 1480)).toBe(444000);
  });

  it("redondea al entero más cercano", () => {
    expect(usdToArs(1, 1480.4)).toBe(1480);
    expect(usdToArs(1, 1480.6)).toBe(1481);
  });
});

describe("roundUsd", () => {
  it("redondea al múltiplo de 5 más cercano (docs/00 §13.5)", () => {
    expect(roundUsd(302)).toBe(300);
    expect(roundUsd(303)).toBe(305);
    expect(roundUsd(300)).toBe(300);
  });
});

describe("roundArs", () => {
  it("redondea al múltiplo de 500 más cercano (docs/00 §13.5)", () => {
    expect(roundArs(140600)).toBe(140500);
    expect(roundArs(140750)).toBe(141000);
    expect(roundArs(500)).toBe(500);
  });
});
