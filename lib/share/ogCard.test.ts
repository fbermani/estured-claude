import { describe, expect, it } from "vitest";
import { arsReferenceLabel, plateNameLayout, priceLabel } from "@/lib/share/ogCard";

describe("vista previa del link: placa", () => {
  it("un nombre corto va en una línea y grande", () => {
    const l = plateNameLayout("Residencia Norte");
    expect(l.lines).toBe(1);
    expect(l.fontSize).toBeGreaterThanOrEqual(64);
    expect(l.fontSize).toBeLessThanOrEqual(108);
  });

  it("nunca pasa de 108 px, ni siquiera con un nombre cortísimo", () => {
    expect(plateNameLayout("Casa").fontSize).toBe(108);
  });

  it("un nombre largo baja a dos líneas con tamaño legible", () => {
    const l = plateNameLayout("Residencia Universitaria Santa Teresa de Jesús");
    expect(l.lines).toBe(2);
    expect(l.fontSize).toBeGreaterThanOrEqual(52);
  });

  it("el tamaño decrece con el largo del nombre", () => {
    expect(plateNameLayout("Residencia Norte").fontSize).toBeGreaterThan(plateNameLayout("Residencia Universitaria Norte").fontSize);
  });
});

describe("vista previa del link: precio", () => {
  it("el precio va siempre en USD con «/mes»", () => {
    expect(priceLabel(190)).toBe("desde USD 190/mes");
    expect(priceLabel(1200)).toContain("USD");
    expect(priceLabel(190)).not.toContain("US$");
  });

  it("la referencia en pesos aclara que es referencial", () => {
    const t = arsReferenceLabel(280000);
    expect(t).toContain("ARS");
    expect(t).toContain("referencial");
    expect(t).toMatch(/^\$ 280\.000 ARS/);
  });
});
