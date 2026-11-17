import { describe, expect, it } from "vitest";
import { faqChipLabel, longestWord, pickHeroCover, photosButtonLabel, plateTitleFontSize } from "@/lib/residences/fichaHero";
import { pickRotationPhotos } from "@/lib/residences/photoMeta";

const photo = (url: string, extra: Partial<{ featured: boolean; coverOrder: number | null; sortOrder: number }> = {}) => ({
  url,
  featured: false,
  coverOrder: null,
  sortOrder: 0,
  ...extra,
});

describe("pickHeroCover", () => {
  it("sin fotos no hay portada (el hero muestra el fondo de marca, sin foto inventada)", () => {
    expect(pickHeroCover([])).toBeNull();
  });

  it("con una sola foto, esa es la portada", () => {
    expect(pickHeroCover([photo("a")])?.url).toBe("a");
  });

  it("sin destacadas usa la primera de la galería", () => {
    expect(pickHeroCover([photo("a"), photo("b")])?.url).toBe("a");
  });

  it("con destacadas, la portada es la primera en el orden elegido por la residencia", () => {
    const photos = [photo("a"), photo("b", { featured: true, coverOrder: 2 }), photo("c", { featured: true, coverOrder: 1 })];
    expect(pickHeroCover(photos)?.url).toBe("c");
  });

  it("coincide siempre con la primera de las que rotan (mismo criterio que la imagen de vista previa del link)", () => {
    const photos = [photo("a", { sortOrder: 3 }), photo("b", { featured: true, sortOrder: 2 }), photo("c", { featured: true, sortOrder: 1 })];
    expect(pickHeroCover(photos)).toBe(pickRotationPhotos(photos)[0]);
  });
});

describe("textos de los botones", () => {
  it("botón del visor de fotos", () => {
    expect(photosButtonLabel(0)).toBeNull();
    expect(photosButtonLabel(1)).toBe("Ver la foto");
    expect(photosButtonLabel(24)).toBe("Ver las 24 fotos");
  });

  it("botón de preguntas frecuentes", () => {
    expect(faqChipLabel(0)).toBe("Hacé una pregunta");
    expect(faqChipLabel(1)).toBe("Leé la respuesta rápida");
    expect(faqChipLabel(6)).toBe("Leé las 6 respuestas rápidas");
  });
});

describe("plateTitleFontSize", () => {
  const max = (css: string) => Number(/, (\d+)px\)$/.exec(css)?.[1]);

  it("longestWord mide la palabra que no se puede partir", () => {
    expect(longestWord("Residencia Norte")).toBe(10);
    expect(longestWord("  Casa   de   Palermo ")).toBe(7);
    expect(longestWord("")).toBe(0);
  });

  it("un nombre corto sale grande (tope de 120 px) y uno con una palabra larga achica", () => {
    expect(max(plateTitleFontSize("Casa Sur"))).toBe(120);
    expect(max(plateTitleFontSize("Residencia Norte"))).toBeLessThan(120);
    expect(max(plateTitleFontSize("Residencia Universitaria Internacional"))).toBeLessThan(max(plateTitleFontSize("Residencia Norte")));
  });

  it("escala con el ancho de la placa (cqw) y respeta un mínimo legible", () => {
    const css = plateTitleFontSize("Residencia Norte");
    expect(css).toContain("100cqw");
    expect(css.startsWith("clamp(1.75rem,")).toBe(true);
  });

  it("el tope nunca baja del mínimo ni siquiera con una palabra enorme", () => {
    expect(max(plateTitleFontSize("Supercalifragilisticoespialidosoextraordinario"))).toBeGreaterThanOrEqual(28);
  });
});
