import { describe, expect, it } from "vitest";
import { allPhotosLabel, moreLabel, pickMosaicTiles, tileCaption, GENERIC_CAPTION } from "@/lib/residences/fichaMosaic";
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

  it("textos", () => {
    expect(moreLabel(21)).toBe("+ 21 fotos");
    expect(moreLabel(1)).toBe("+ 1 foto");
    expect(allPhotosLabel(24)).toBe("Ver todas las fotos (24)");
  });
});
