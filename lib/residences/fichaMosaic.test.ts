import { describe, expect, it } from "vitest";
import { allPhotosLabel, buildMosaicSlots, emptyMosaicNote, moreLabel, pickMosaicTiles, tileCaption, GENERIC_CAPTION } from "@/lib/residences/fichaMosaic";
import type { GalleryPhoto } from "@/lib/residences/photoMeta";

const photo = (over: Partial<GalleryPhoto> & { url: string }): GalleryPhoto => ({
  category: "general",
  area: null,
  roomTypeName: null,
  featured: false,
  ...over,
});

describe("pickMosaicTiles", () => {
  it("con menos de 2 fotos no hay mosaico", () => {
    expect(pickMosaicTiles([])).toEqual([]);
    expect(pickMosaicTiles([photo({ url: "a" })])).toEqual([]);
  });

  it("2 fotos: 2 tarjetas, ninguna con «+ N»", () => {
    const tiles = pickMosaicTiles([photo({ url: "a", featured: true }), photo({ url: "b", category: "area", area: "patio" })]);
    expect(tiles).toHaveLength(2);
    expect(tiles.some((t) => t.more)).toBe(false);
  });

  it("evita repetir la portada y prefiere áreas comunes de secciones distintas", () => {
    const photos = [
      photo({ url: "cover", featured: true, isCover: true }),
      photo({ url: "p1", category: "area", area: "patio" }),
      photo({ url: "p2", category: "area", area: "patio" }),
      photo({ url: "k", category: "area", area: "cocina" }),
      photo({ url: "r", category: "room_type", roomTypeName: "Doble" }),
    ];
    const tiles = pickMosaicTiles(photos);
    expect(tiles.map((t) => t.photo.url)).toEqual(["p1", "k", "p2"]);
    expect(tiles.map((t) => t.caption)).toEqual(["Patio", "Cocina", "+ 2 fotos"]);
    expect(tiles[2].more).toBe(true);
  });

  it("con exactamente 3 fotos la última lleva su propio rótulo (sin «+ N»)", () => {
    const tiles = pickMosaicTiles([
      photo({ url: "a", featured: true }),
      photo({ url: "b", category: "area", area: "terraza" }),
      photo({ url: "c", category: "area", area: "cocina" }),
    ]);
    expect(tiles).toHaveLength(3);
    expect(tiles.some((t) => t.more)).toBe(false);
  });

  it("una foto general sin sección no se rotula «Fotos adicionales»", () => {
    expect(tileCaption(photo({ url: "x" }))).toBe(GENERIC_CAPTION);
    expect(tileCaption(photo({ url: "x", section: "Patio con parrilla" }))).toBe("Patio con parrilla");
  });

  it("el rótulo genérico es corto (no se corta en las tarjetas chicas del celular)", () => {
    expect(GENERIC_CAPTION.length).toBeLessThanOrEqual(10);
  });

  it("textos", () => {
    expect(allPhotosLabel(1)).toBe("Ver la foto");
    expect(moreLabel(21)).toBe("+ 21 fotos");
    expect(moreLabel(1)).toBe("+ 1 foto");
    expect(allPhotosLabel(24)).toBe("Ver todas las fotos (24)");
  });
});

describe("buildMosaicSlots", () => {
  it("0 fotos: 3 tarjetas vacías", () => {
    expect(buildMosaicSlots([]).map((s) => s.kind)).toEqual(["empty", "empty", "empty"]);
  });

  it("1 foto: esa en la grande y 2 vacías, sin «+ N»", () => {
    const slots = buildMosaicSlots([photo({ url: "a" })]);
    expect(slots.map((s) => s.kind)).toEqual(["photo", "empty", "empty"]);
    const first = slots[0];
    expect(first.kind === "photo" && first.tile.photo.url).toBe("a");
    expect(first.kind === "photo" && first.tile.more).toBe(false);
  });

  it("2 fotos: 2 tarjetas con foto, ninguna vacía (como siempre)", () => {
    const slots = buildMosaicSlots([photo({ url: "a", featured: true }), photo({ url: "b" })]);
    expect(slots.map((s) => s.kind)).toEqual(["photo", "photo"]);
  });

  it("3 y más fotos: 3 tarjetas con foto, igual que pickMosaicTiles", () => {
    const photos = [1, 2, 3, 4, 5].map((n) => photo({ url: `p${n}`, category: "area", area: `area${n}` }));
    const slots = buildMosaicSlots(photos);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.kind === "photo")).toBe(true);
    expect(slots.map((s) => (s.kind === "photo" ? s.tile.photo.url : ""))).toEqual(pickMosaicTiles(photos).map((t) => t.photo.url));
  });

  it("aclaración para lectores sin prometer fotos", () => {
    expect(emptyMosaicNote(0)).toBe("Esta residencia todavía no subió fotos.");
    expect(emptyMosaicNote(1)).toMatch(/todavía no subió más fotos/);
  });
});
