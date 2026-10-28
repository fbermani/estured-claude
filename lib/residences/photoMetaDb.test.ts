import { describe, expect, it } from "vitest";
import { buildGalleryPhotos, rotationUrls, type PhotoMetaRow } from "./photoMetaDb";
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

describe("residentsToDisplay (gating Premium, fail-closed)", () => {
  it("solo Premium confirmado y con estadías", () => {
    expect(residentsToDisplay(true, 5)).toBe(5);
    expect(residentsToDisplay(true, 0)).toBeNull();
    expect(residentsToDisplay(false, 5)).toBeNull();
    expect(residentsToDisplay(null, 5)).toBeNull();
    expect(residentsToDisplay(undefined, 5)).toBeNull();
  });
});
