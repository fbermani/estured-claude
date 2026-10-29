import { describe, expect, it } from "vitest";
import { formatBlocks, kmToBlocks } from "./distance";

describe("distancia en cuadras", () => {
  it("convierte km a cuadras de ~100 m", () => {
    expect(kmToBlocks(0.6)).toBe(6);
    expect(kmToBlocks(1.24)).toBe(12);
  });
  it("nunca muestra 0 cuadras", () => {
    expect(kmToBlocks(0.02)).toBe(1);
    expect(formatBlocks(0.02)).toBe("~1 cuadra");
  });
  it("valores inválidos dan 0", () => {
    expect(kmToBlocks(Number.NaN)).toBe(0);
    expect(kmToBlocks(-1)).toBe(0);
  });
  it("formatea en plural", () => {
    expect(formatBlocks(0.9)).toBe("~9 cuadras");
  });
});
