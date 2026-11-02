import { describe, expect, it } from "vitest";
import { effectiveSection, groupGalleryPhotos, groupPhotosBySections, pickRotationPhotos, validatePhotoMeta, type GalleryPhoto } from "./photoMeta";

const ctx = { validFileIds: new Set(["f1", "f2", "f3"]), validRoomTypeIds: new Set(["rt1"]) };

describe("validatePhotoMeta", () => {
  it("acepta general, área y tipo; normaliza campos ajenos", () => {
    const r = validatePhotoMeta(
      [
        { fileId: "f1", category: "general", area: "cocina", roomTypeId: "rt1", featured: true },
        { fileId: "f2", category: "area", area: "cocina", featured: false },
        { fileId: "f3", category: "room_type", roomTypeId: "rt1", featured: false },
      ],
      ctx,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0]).toMatchObject({ area: null, roomTypeId: null, featured: true });
      expect(r.items[1].area).toBe("cocina");
      expect(r.items[2].roomTypeId).toBe("rt1");
    }
  });
  it("rechaza fotos ajenas, áreas/tipos inválidos y duplicados", () => {
    expect(validatePhotoMeta([{ fileId: "zz", category: "general" }], ctx).ok).toBe(false);
    expect(validatePhotoMeta([{ fileId: "f1", category: "area", area: "inventada" }], ctx).ok).toBe(false);
    expect(validatePhotoMeta([{ fileId: "f1", category: "room_type", roomTypeId: "otro" }], ctx).ok).toBe(false);
    expect(validatePhotoMeta([{ fileId: "f1", category: "general" }, { fileId: "f1", category: "general" }], ctx).ok).toBe(false);
    expect(validatePhotoMeta("x", ctx).ok).toBe(false);
  });
  it("tope de 5 destacadas", () => {
    const big = { validFileIds: new Set(["1", "2", "3", "4", "5", "6"]), validRoomTypeIds: new Set<string>() };
    const mk = (n: number) => Array.from({ length: 6 }, (_, i) => ({ fileId: String(i + 1), category: "general", featured: i < n }));
    expect(validatePhotoMeta(mk(5), big).ok).toBe(true);
    expect(validatePhotoMeta(mk(6), big).ok).toBe(false);
  });
});

describe("rotación y agrupado", () => {
  const p = (url: string, featured = false, category: GalleryPhoto["category"] = "general", area: string | null = null, rt: string | null = null): GalleryPhoto => ({
    url, featured, category, area, roomTypeName: rt,
  });
  it("rota las destacadas; sin destacadas, las primeras 5", () => {
    expect(pickRotationPhotos([p("a"), p("b", true), p("c", true)]).map((x) => x.url)).toEqual(["b", "c"]);
    expect(pickRotationPhotos(["a", "b", "c", "d", "e", "f", "g"].map((u) => p(u))).map((x) => x.url)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("agrupa General, áreas y tipos", () => {
    const g = groupGalleryPhotos([p("1", false, "room_type", null, "Doble"), p("2", false, "area", "cocina"), p("3")]);
    expect(g.map((x) => x.title)).toEqual(["General", "Cocina", "Habitación: Doble"]);
  });
});

describe("secciones (DR30)", () => {
  const base = { category: "general" as const, area: null, roomTypeName: null };
  it("valida y normaliza section / sortOrder", () => {
    const r = validatePhotoMeta([{ fileId: "f1", category: "general", section: "  Cocina   completa ", sortOrder: 3 }, { fileId: "f2", category: "general", section: "   ", sortOrder: -1 }], ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0]).toMatchObject({ section: "Cocina completa", sortOrder: 3 });
      expect(r.items[1]).toMatchObject({ section: null, sortOrder: 0 });
    }
    expect(validatePhotoMeta([{ fileId: "f1", category: "general", section: "x".repeat(41) }], ctx).ok).toBe(false);
  });
  it("sección efectiva: section > área / tipo > Fotos adicionales", () => {
    expect(effectiveSection({ ...base, section: "Pileta" })).toBe("Pileta");
    expect(effectiveSection({ category: "area", area: "cocina", roomTypeName: null })).toBe("Cocina");
    expect(effectiveSection({ category: "room_type", area: null, roomTypeName: "Doble" })).toBe("Doble");
    expect(effectiveSection(base)).toBe("Fotos adicionales");
  });
  it("agrupa por orden de aparición con «Fotos adicionales» al final", () => {
    const g = groupPhotosBySections([
      { ...base, section: null, sortOrder: 0, id: "a" },
      { ...base, section: "Living", sortOrder: 1, id: "b" },
      { ...base, section: "Cocina", sortOrder: 2, id: "c" },
      { ...base, section: "living", sortOrder: 3, id: "d" },
    ]);
    expect(g.map((x) => x.title)).toEqual(["Living", "Cocina", "Fotos adicionales"]);
    expect(g[0].photos.map((x) => x.id)).toEqual(["b", "d"]);
  });
  it("respeta sortOrder y es estable con empates", () => {
    const g = groupPhotosBySections([
      { ...base, section: "B", sortOrder: 5, id: "1" },
      { ...base, section: "A", sortOrder: 1, id: "2" },
      { ...base, section: "A", sortOrder: 1, id: "3" },
    ]);
    expect(g.map((x) => x.title)).toEqual(["A", "B"]);
    expect(g[0].photos.map((x) => x.id)).toEqual(["2", "3"]);
  });
});
