import { describe, expect, it } from "vitest";
import { safeFilename } from "./safeFilename";

describe("safeFilename", () => {
  it("quita separadores de ruta y caracteres de control", () => {
    expect(safeFilename("../a\\b/c\u0000d\n.pdf")).toBe("..abcd.pdf");
  });
  it("devuelve un nombre por defecto si queda vacío", () => {
    expect(safeFilename("///")).toBe("archivo");
    expect(safeFilename(undefined)).toBe("archivo");
  });
  it("recorta a 255 preservando la extensión", () => {
    const out = safeFilename("x".repeat(400) + ".pdf");
    expect(out.length).toBe(255);
    expect(out.endsWith(".pdf")).toBe(true);
  });
  it("no toca nombres normales", () => {
    expect(safeFilename("comprobante.png")).toBe("comprobante.png");
  });
});
