import { describe, expect, it } from "vitest";
import {
  initialOpenKeys,
  isSectionOpen,
  needsAttention,
  openSection,
  photoCountLabel,
  summarizeSection,
  toggleSection,
  type SectionActivity,
} from "./photoSectionCollapse";

const base = (over: Partial<SectionActivity> = {}): SectionActivity => ({
  key: "area:living",
  photos: 0,
  pendingPhotos: 0,
  uploading: 0,
  failedUploads: 0,
  ...over,
});

describe("photoCountLabel", () => {
  it("usa singular, plural y vacío", () => {
    expect(photoCountLabel(0)).toBe("Sin fotos");
    expect(photoCountLabel(1)).toBe("1 foto");
    expect(photoCountLabel(6)).toBe("6 fotos");
  });
});

describe("summarizeSection", () => {
  it("sin novedades no muestra estado", () => {
    expect(summarizeSection(base({ photos: 3 }))).toEqual({ countLabel: "3 fotos", status: null });
  });
  it("cuenta las subidas en curso y lo avisa", () => {
    expect(summarizeSection(base({ photos: 2, uploading: 1 }))).toEqual({ countLabel: "3 fotos", status: { label: "Subiendo…", tone: "neutral" } });
  });
  it("muestra las fotos en revisión", () => {
    expect(summarizeSection(base({ photos: 4, pendingPhotos: 1 })).status).toEqual({ label: "1 en revisión", tone: "warning" });
    expect(summarizeSection(base({ photos: 4, pendingPhotos: 3 })).status).toEqual({ label: "3 en revisión", tone: "warning" });
  });
  it("el error de subida gana a todo lo demás", () => {
    const s = summarizeSection(base({ photos: 1, uploading: 1, pendingPhotos: 1, failedUploads: 2 }));
    expect(s.status).toEqual({ label: "2 fotos no se subieron", tone: "danger" });
    expect(summarizeSection(base({ failedUploads: 1 })).status?.label).toBe("Una foto no se subió");
  });
});

describe("estado inicial del colapso", () => {
  it("todo arranca colapsado salvo secciones con subida fallida", () => {
    const list = [base({ key: "facade", photos: 6 }), base({ key: "area:patio", failedUploads: 1 }), base({ key: "rt:1", photos: 2, pendingPhotos: 2 })];
    expect([...initialOpenKeys(list)]).toEqual(["area:patio"]);
    expect(needsAttention(list[1])).toBe(true);
    expect(needsAttention(list[0])).toBe(false);
  });
  it("sin secciones no hay claves abiertas", () => {
    expect(initialOpenKeys([]).size).toBe(0);
  });
});

describe("alternar y abrir secciones", () => {
  const initial = new Set(["a"]);
  it("sin elección manda el estado inicial", () => {
    expect(isSectionOpen("a", {}, initial)).toBe(true);
    expect(isSectionOpen("b", {}, initial)).toBe(false);
  });
  it("la elección explícita gana al estado inicial", () => {
    expect(isSectionOpen("a", { a: false }, initial)).toBe(false);
    expect(isSectionOpen("b", { b: true }, initial)).toBe(true);
  });
  it("toggleSection invierte lo que se ve y no muta el original", () => {
    const start: Record<string, boolean> = {};
    const once = toggleSection("a", start, initial);
    expect(once).toEqual({ a: false });
    expect(toggleSection("a", once, initial)).toEqual({ a: true });
    expect(toggleSection("b", start, initial)).toEqual({ b: true });
    expect(start).toEqual({});
  });
  it("openSection abre una cerrada y devuelve el mismo objeto si ya estaba abierta", () => {
    const toggled = { a: true };
    expect(openSection("a", toggled, initial)).toBe(toggled);
    expect(openSection("b", toggled, initial)).toEqual({ a: true, b: true });
    expect(openSection("a", { a: false }, initial)).toEqual({ a: true });
  });
});
