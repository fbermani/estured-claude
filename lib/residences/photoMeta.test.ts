import { describe, expect, it } from "vitest";
import { groupGalleryPhotos, pickRotationPhotos, validatePhotoMeta, type GalleryPhoto } from "./photoMeta";

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
