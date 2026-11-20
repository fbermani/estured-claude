import { describe, expect, it } from "vitest";
import { buildGalleryPhotos, loadPhotoMeta, reconcileMetaRow, rotationUrls, type PhotoMetaRow } from "./photoMetaDb";
import { createInMemorySupabase } from "@/lib/testing/inMemorySupabase";
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

describe("foto principal (0097)", () => {
  it("buildGalleryPhotos la marca y rotationUrls la pone primera", () => {
    const meta = new Map<string, PhotoMetaRow>([
      ["1", { file_id: "1", residence_id: "r", category: "general", area: null, room_type_id: null, is_featured: true, cover_order: 1 }],
      ["3", { file_id: "3", residence_id: "r", category: "general", area: null, room_type_id: null, is_featured: false, is_cover: true }],
    ]);
    const g = buildGalleryPhotos(files, meta, url, new Map());
    expect(g.map((p) => p.isCover)).toEqual([false, false, true]);
    expect(rotationUrls(g)).toEqual(["https://x/c.jpg", "https://x/a.jpg"]);
  });

  const row = { file_id: "1", residence_id: "r", category: "general", area: null, room_type_id: null, is_featured: true, section: null, sort_order: 0, cover_order: 1, is_cover: true };
  it("loadPhotoMeta lee is_cover y avisa que está listo", async () => {
    const db = createInMemorySupabase({ residence_photo_meta: [row] });
    const r = await loadPhotoMeta(db.client, ["r"], { reconcile: false });
    expect(r).toMatchObject({ schemaReady: true, sectionsReady: true, coverReady: true, mainCoverReady: true });
    expect(r.byFileId.get("1")?.is_cover).toBe(true);
  });
  it("sin la 0097 degrada a la 0074 (portada con orden) sin perder nada más", async () => {
    const db = createInMemorySupabase({ residence_photo_meta: [row] }, { missingColumns: { residence_photo_meta: ["is_cover"] } });
    expect(await loadPhotoMeta(db.client, ["r"], { reconcile: false })).toMatchObject({ schemaReady: true, sectionsReady: true, coverReady: true, mainCoverReady: false });
  });
  it("sin la 0074 ni la 0097 degrada a la 0070, y sin la 0070 a la 0059", async () => {
    const no74 = createInMemorySupabase({ residence_photo_meta: [row] }, { missingColumns: { residence_photo_meta: ["is_cover", "cover_order"] } });
    expect(await loadPhotoMeta(no74.client, ["r"], { reconcile: false })).toMatchObject({ sectionsReady: true, coverReady: false, mainCoverReady: false });
    const no70 = createInMemorySupabase({ residence_photo_meta: [row] }, { missingColumns: { residence_photo_meta: ["is_cover", "cover_order", "section"] } });
    expect(await loadPhotoMeta(no70.client, ["r"], { reconcile: false })).toMatchObject({ schemaReady: true, sectionsReady: false, coverReady: false, mainCoverReady: false });
  });
  it("la tabla inexistente no rompe", async () => {
    const db = createInMemorySupabase({}, { missingTables: ["residence_photo_meta"] });
    expect(await loadPhotoMeta(db.client, ["r"])).toMatchObject({ schemaReady: false, mainCoverReady: false });
  });
});
