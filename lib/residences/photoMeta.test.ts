import { describe, expect, it } from "vitest";
import { PHOTO_AREAS, PRESENTATION_LABEL, areaLabel, effectiveSection, groupGalleryPhotos, groupPhotosBySections, pickRotationPhotos, validatePhotoMeta, type GalleryPhoto } from "./photoMeta";

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

describe("portada de la tarjeta y agrupado", () => {
  const p = (url: string, featured = false, category: GalleryPhoto["category"] = "general", area: string | null = null, rt: string | null = null): GalleryPhoto => ({
    url, featured, category, area, roomTypeName: rt,
  });
  it("la portada son las destacadas; sin destacadas, las primeras 5", () => {
    expect(pickRotationPhotos([p("a"), p("b", true), p("c", true)]).map((x) => x.url)).toEqual(["b", "c"]);
    expect(pickRotationPhotos(["a", "b", "c", "d", "e", "f", "g"].map((u) => p(u))).map((x) => x.url)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("las de portada salen en el orden elegido (coverOrder) y, sin él, según el de la galería", () => {
    const f = (url: string, coverOrder: number | null, sortOrder = 0) => ({ ...p(url, true), coverOrder, sortOrder });
    expect(pickRotationPhotos([f("a", 2), f("b", 1), f("c", null, 0)]).map((x) => x.url)).toEqual(["b", "a", "c"]);
    expect(pickRotationPhotos([f("a", null, 5), f("b", null, 1)]).map((x) => x.url)).toEqual(["b", "a"]);
  });
  it("agrupa General, áreas y tipos", () => {
    const g = groupGalleryPhotos([p("1", false, "room_type", null, "Doble"), p("2", false, "area", "cocina"), p("3")]);
    expect(g.map((x) => x.title)).toEqual(["General", "Cocina", "Habitación: Doble"]);
  });
});

describe("orden de portada (0074)", () => {
  const big = { validFileIds: new Set(["1", "2", "3", "4"]), validRoomTypeIds: new Set<string>() };
  it("normaliza coverOrder a 1..N para las destacadas y null para el resto", () => {
    const r = validatePhotoMeta(
      [
        { fileId: "1", category: "general", featured: true, coverOrder: 4 },
        { fileId: "2", category: "general", featured: true },
        { fileId: "3", category: "general", featured: true, coverOrder: 4 },
        { fileId: "4", category: "general", featured: false, coverOrder: 2 },
      ],
      big,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items.map((i) => i.coverOrder)).toEqual([1, 3, 2, null]);
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

describe("foto principal o de presentación (rótulo visible, sin migrar datos)", () => {
  const base = { category: "general" as const, area: null, roomTypeName: null };
  it("la etiqueta del área `entrada` es la nueva; el valor guardado no cambia", () => {
    expect(PHOTO_AREAS.find((a) => a.value === "entrada")?.label).toBe("Foto principal o de presentación");
    expect(areaLabel("entrada")).toBe(PRESENTATION_LABEL);
    expect(PHOTO_AREAS.map((a) => a.value)).toContain("entrada");
  });
  it("el nombre de sección viejo «Fachada / Exterior» se muestra con la etiqueta nueva (sin distinguir mayúsculas)", () => {
    expect(effectiveSection({ category: "area", area: "entrada", roomTypeName: null, section: "Fachada / Exterior" })).toBe(PRESENTATION_LABEL);
    expect(effectiveSection({ ...base, section: " fachada / exterior " })).toBe(PRESENTATION_LABEL);
  });
  it("sin nombre guardado, el área entrada también cae en la etiqueta nueva", () => {
    expect(effectiveSection({ category: "area", area: "entrada", roomTypeName: null, section: null })).toBe(PRESENTATION_LABEL);
  });
  it("lo viejo y lo nuevo caen en UNA sola sección y ningún título conserva «Fachada»", () => {
    const g = groupPhotosBySections([
      { category: "area" as const, area: "entrada", roomTypeName: null, section: "Fachada / Exterior", sortOrder: 0, id: "a" },
      { category: "area" as const, area: "entrada", roomTypeName: null, section: null, sortOrder: 1, id: "b" },
      { category: "area" as const, area: "entrada", roomTypeName: null, section: PRESENTATION_LABEL, sortOrder: 2, id: "c" },
    ]);
    expect(g.map((x) => x.title)).toEqual([PRESENTATION_LABEL]);
    expect(g[0].photos.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("secciones sin fotos no se publican en la ficha", () => {
  const sec = (section: string | null, over: Partial<GalleryPhoto> = {}) => ({ category: "general" as const, area: null, roomTypeName: null, section, sortOrder: 0, ...over });
  it("sin fotos no hay ninguna sección (ni «Fotos adicionales»)", () => {
    expect(groupPhotosBySections([])).toEqual([]);
  });
  it("las secciones son exactamente las de las fotos, cada una con al menos una; «Fotos adicionales» solo si hay una foto sin sección", () => {
    const withExtra = groupPhotosBySections([sec("Patio"), sec(null), sec("Patio")]);
    expect(withExtra.map((g) => g.title)).toEqual(["Patio", "Fotos adicionales"]);
    const withoutExtra = groupPhotosBySections([sec("Patio"), sec("Cocina"), sec("Patio")]);
    expect(withoutExtra.map((g) => g.title)).toEqual(["Patio", "Cocina"]);
    for (const g of [...withExtra, ...withoutExtra]) expect(g.photos.length).toBeGreaterThan(0);
  });
  it("una foto en un área o tipo que ya no existe no genera una sección vacía: cae en «Fotos adicionales»", () => {
    const g = groupPhotosBySections([sec(null, { category: "room_type", roomTypeName: null })]);
    expect(g.map((x) => x.title)).toEqual(["Fotos adicionales"]);
    expect(g[0].photos).toHaveLength(1);
  });
});

describe("foto principal (isCover, migración 0097)", () => {
  const photo = (url: string, extra: Partial<GalleryPhoto> = {}): GalleryPhoto => ({ url, category: "general", area: null, roomTypeName: null, featured: false, ...extra });

  it("sin foto principal nada cambia", () => {
    expect(pickRotationPhotos([photo("a"), photo("b", { featured: true, coverOrder: 1 }), photo("c", { featured: true, coverOrder: 2 })]).map((x) => x.url)).toEqual(["b", "c"]);
  });
  it("la principal va siempre primera aunque no sea de las de portada, y las demás siguen detrás en su orden", () => {
    const list = [photo("a"), photo("b", { featured: true, coverOrder: 1 }), photo("c", { featured: true, coverOrder: 2 }), photo("d", { isCover: true })];
    expect(pickRotationPhotos(list).map((x) => x.url)).toEqual(["d", "b", "c"]);
  });
  it("si la principal ya es de portada, se mueve al frente sin repetirse", () => {
    const list = [photo("a", { featured: true, coverOrder: 1 }), photo("b", { featured: true, coverOrder: 2 }), photo("c", { featured: true, coverOrder: 3, isCover: true })];
    expect(pickRotationPhotos(list).map((x) => x.url)).toEqual(["c", "a", "b"]);
  });
  it("sin portadas elegidas, la principal encabeza las primeras 5 y el total no pasa de 5", () => {
    const list = ["a", "b", "c", "d", "e", "f", "g"].map((u) => photo(u, u === "g" ? { isCover: true } : {}));
    expect(pickRotationPhotos(list).map((x) => x.url)).toEqual(["g", "a", "b", "c", "d"]);
  });
  it("con 5 de portada más una principal aparte, el total sigue en 5", () => {
    const list = [
      ...["a", "b", "c", "d", "e"].map((u, i) => photo(u, { featured: true, coverOrder: i + 1 })),
      photo("z", { isCover: true }),
    ];
    const out = pickRotationPhotos(list).map((x) => x.url);
    expect(out).toEqual(["z", "a", "b", "c", "d"]);
  });
});
