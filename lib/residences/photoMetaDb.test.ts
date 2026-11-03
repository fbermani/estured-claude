import { describe, expect, it } from "vitest";
import { buildGalleryPhotos, reconcileMetaRow, rotationUrls, type PhotoMetaRow } from "./photoMetaDb";
import { buildPhotoSections } from "./photoSections";
import { residentsToDisplay } from "./occupancy";

const url = (p: string) => `https://x/${p}`;
const files = [
  { id: "1", storage_path: "a.jpg" },
  { id: "2", storage_path: "b.jpg" },
  { id: "3", storage_path: "c.jpg" },
];

describe("buildGalleryPhotos / rotationUrls", () => {
  it("sin metadatos: todo general, sin destacadas, rotan las primeras", () => {
    const g = buildGalleryPhotos(files, new Map(), url, new Map());
    expect(g.every((p) => p.category === "general" && !p.featured && p.area === null)).toBe(true);
    expect(rotationUrls(g)).toEqual(["https://x/a.jpg", "https://x/b.jpg", "https://x/c.jpg"]);
  });
  it("room_type con tipo inexistente queda sin nombre; rotan las destacadas", () => {
    const meta = new Map<string, PhotoMetaRow>([
      ["2", { file_id: "2", residence_id: "r", category: "room_type", area: null, room_type_id: "gone", is_featured: true }],
      ["3", { file_id: "3", residence_id: "r", category: "area", area: "cocina", room_type_id: null, is_featured: false }],
    ]);
    const g = buildGalleryPhotos(files, meta, url, new Map([["rt1", "Doble"]]));
    expect(g[1].roomTypeName).toBeNull();
    expect(g[2].area).toBe("cocina");
    expect(rotationUrls(g)).toEqual(["https://x/b.jpg"]);
  });
});

describe("reconcileMetaRow (ficha pública: secciones = áreas comunes y tipos activos)", () => {
  const defs = buildPhotoSections({
    commonAreas: ["Patio", "Gimnasio"],
    customAreas: [{ label: "Huerta", status: "approved" }],
    roomTypes: [{ id: "rt1", name: "Doble" }],
    sectionNamesReady: true,
  });
  const row = (over: Partial<PhotoMetaRow>): PhotoMetaRow => ({
    file_id: "f", residence_id: "r", category: "general", area: null, room_type_id: null, is_featured: true, section: null, sort_order: 3, cover_order: 2, ...over,
  });
  it("área elegida, «Otro» aprobado y tipo activo conservan su sección y no pierden portada ni orden", () => {
    expect(reconcileMetaRow(row({ category: "area", area: "patio", section: "Patio" }), defs, true)).toMatchObject({ category: "area", area: "patio", section: "Patio", is_featured: true, sort_order: 3, cover_order: 2 });
    expect(reconcileMetaRow(row({ category: "area", area: "otra", section: "huerta" }), defs, true)).toMatchObject({ area: "otra", section: "Huerta" });
    expect(reconcileMetaRow(row({ category: "room_type", room_type_id: "rt1", section: "Habitación Doble" }), defs, true)).toMatchObject({ category: "room_type", room_type_id: "rt1" });
  });
  it("área destildada, tipo desactivado y «Otro» no aprobado pasan a general (la foto sigue y sigue de portada)", () => {
    for (const r of [
      row({ category: "area", area: "terraza", section: "Terraza" }),
      row({ category: "room_type", room_type_id: "gone", section: "Habitación Vieja" }),
      row({ category: "area", area: "otra", section: "Pileta" }),
    ]) {
      expect(reconcileMetaRow(r, defs, true)).toMatchObject({ category: "general", area: null, room_type_id: null, section: null, is_featured: true, cover_order: 2 });
    }
  });
  it("sin la 0070 no escribe `section`", () => {
    const sin = buildPhotoSections({ commonAreas: ["Patio"], roomTypes: [], sectionNamesReady: false });
    const out = reconcileMetaRow(row({ category: "area", area: "patio" }), sin, false);
    expect(out.category).toBe("area");
    expect("section" in out && out.section !== null).toBe(false);
  });
});

describe("residentsToDisplay (gating Premium, fail-closed)", () => {
  it("solo Premium confirmado y con estadías", () => {
    expect(residentsToDisplay(true, 5)).toBe(5);
    expect(residentsToDisplay(true, 0)).toBeNull();
    expect(residentsToDisplay(false, 5)).toBeNull();
    expect(residentsToDisplay(null, 5)).toBeNull();
    expect(residentsToDisplay(undefined, 5)).toBeNull();
  });
});
