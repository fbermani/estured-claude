import { describe, expect, it } from "vitest";
import {
  UNSORTED_KEY,
  appendPhotos,
  assignmentFor,
  buildPhotoSections,
  coverPhotos,
  galleryOrder,
  isOrphaned,
  moveCover,
  movePhotoToSection,
  normalizeCover,
  reconcileAssignment,
  sectionKeyOf,
  toggleCover,
  type PhotoMetaItem,
} from "./photoSections";

const base = { url: "u", pending: false, featured: false, sortOrder: 0, coverOrder: null, category: "general" as const, area: null, roomTypeId: null, section: null };
const photo = (id: string, over: Partial<PhotoMetaItem> = {}): PhotoMetaItem => ({ ...base, id, ...over });

const defs = buildPhotoSections({
  commonAreas: ["Sala de Estar", "Sala de Estudio", "Área de Estudio", "Sala de Juegos", "Gimnasio", "Cocina compartida"],
  roomTypes: [{ id: "rt1", name: "Doble" }],
  sectionNamesReady: true,
});

describe("buildPhotoSections", () => {
  it("arma Fachada, áreas elegidas (estudio sin repetir) y tipos, en ese orden; nada más", () => {
    expect(defs.map((d) => d.title)).toEqual([
      "Foto principal o de presentación",
      "Sala de Estar",
      "Sala de Estudio",
      "Sala de Juegos",
      "Gimnasio",
      "Cocina compartida",
      "Habitación Doble",
    ]);
  });
  it("sin nombres de sección (0070) no ofrece «Sala de Juegos» y no guarda `section`", () => {
    const d = buildPhotoSections({ commonAreas: ["Sala de Juegos", "Patio"], roomTypes: [], sectionNamesReady: false });
    expect(d.map((x) => x.title)).toEqual(["Foto principal o de presentación", "Patio"]);
    expect(d.every((x) => x.assign.section === null)).toBe(true);
  });
  it("una sección por cada «Otro» de área (aprobado o pendiente, marcado), sin rechazados ni repetidos", () => {
    const d = buildPhotoSections({
      commonAreas: ["Patio"],
      customAreas: [
        { label: " Huerta ", status: "approved" },
        { label: "Pileta", status: "pending" },
        { label: "Spa", status: "rejected" },
        { label: "huerta", status: "approved" },
        { label: "Patio", status: "approved" },
      ],
      roomTypes: [],
      sectionNamesReady: true,
    });
    expect(d.map((x) => x.title)).toEqual(["Foto principal o de presentación", "Patio", "Huerta", "Pileta"]);
    expect(d.map((x) => !!x.pending)).toEqual([false, false, false, true]);
    expect(d[2].assign).toMatchObject({ category: "area", area: "otra", section: "Huerta" });
  });
  it("un área que ya no está elegida no deja sección aunque haya fotos viejas", () => {
    const d = buildPhotoSections({ commonAreas: [], roomTypes: [], sectionNamesReady: true });
    expect(d.map((x) => x.title)).toEqual(["Foto principal o de presentación"]);
  });
  it("tipos de habitación con el mismo nombre se numeran y mantienen el orden recibido", () => {
    const d = buildPhotoSections({
      commonAreas: [],
      roomTypes: [{ id: "a", name: "Doble" }, { id: "b", name: "Individual" }, { id: "c", name: "doble " }],
      sectionNamesReady: true,
    });
    expect(d.slice(1).map((x) => x.title)).toEqual(["Habitación Doble (1)", "Habitación Individual", "Habitación doble (2)"]);
    expect(new Set(d.map((x) => x.key)).size).toBe(d.length);
  });
  it("ignora áreas desconocidas", () => {
    expect(buildPhotoSections({ commonAreas: ["Inventada"], roomTypes: [], sectionNamesReady: true }).map((d) => d.title)).toEqual(["Foto principal o de presentación"]);
  });
});

describe("sectionKeyOf / assignmentFor", () => {
  it("una foto general sin sección es «Sin clasificar»", () => {
    expect(sectionKeyOf(photo("a"), defs)).toBe(UNSORTED_KEY);
  });
  it("ida y vuelta: lo que se asigna a cada sección se ubica ahí", () => {
    for (const d of defs) {
      const a = assignmentFor(d.key, defs)!;
      expect(sectionKeyOf({ ...a }, defs)).toBe(d.key);
    }
    expect(sectionKeyOf(assignmentFor(UNSORTED_KEY, defs)!, defs)).toBe(UNSORTED_KEY);
  });
  it("lo clasificado sin sección propia (tipo borrado o desactivado, área no elegida, «Otro» no aprobado) queda sin clasificar, no se pierde", () => {
    const orphans = [
      { category: "room_type" as const, area: null, roomTypeId: "gone", section: null },
      { category: "area" as const, area: "lavadero" as const, roomTypeId: null, section: null },
      { category: "area" as const, area: "otra" as const, roomTypeId: null, section: "Pileta" },
      { category: "general" as const, area: null, roomTypeId: null, section: "Dormitorio 1" },
    ];
    for (const o of orphans) {
      expect(sectionKeyOf(o, defs)).toBe(UNSORTED_KEY);
      expect(isOrphaned(o, defs)).toBe(true);
    }
    expect(isOrphaned(photo("a"), defs)).toBe(false); // general sin sección: nunca estuvo clasificada
  });
  it("reconcileAssignment: lo huérfano pasa a general sin nombre, lo vigente toma el nombre actual de su sección", () => {
    const renamed = buildPhotoSections({ commonAreas: [], roomTypes: [{ id: "rt1", name: "Triple" }], sectionNamesReady: true });
    expect(reconcileAssignment({ category: "room_type", area: null, roomTypeId: "rt1", section: "Habitación Doble" }, renamed)).toEqual({
      category: "room_type",
      area: null,
      roomTypeId: "rt1",
      section: "Habitación Triple",
    });
    expect(reconcileAssignment({ category: "area", area: "cocina", roomTypeId: null, section: "Cocina compartida" }, renamed)).toEqual({
      category: "general",
      area: null,
      roomTypeId: null,
      section: null,
    });
    expect(reconcileAssignment({ category: "room_type", area: null, roomTypeId: "gone", section: "Habitación X" }, renamed)).toMatchObject({ category: "general", roomTypeId: null, section: null });
  });
  it("una foto general con el nombre de una sección actual se ubica ahí", () => {
    expect(sectionKeyOf({ category: "general", area: null, roomTypeId: null, section: " gimnasio " }, defs)).toBe("area:gimnasio");
  });
  it("assignmentFor devuelve null para una sección inexistente", () => {
    expect(assignmentFor("nope", defs)).toBeNull();
  });
});

describe("mover y ordenar", () => {
  it("movePhotoToSection cambia la clasificación y deja la foto al final", () => {
    const items = [photo("a"), photo("b")];
    const next = movePhotoToSection(items, "a", "rt:rt1", defs);
    expect(next.map((i) => i.id)).toEqual(["b", "a"]);
    expect(next[1]).toMatchObject({ category: "room_type", roomTypeId: "rt1", section: "Habitación Doble" });
    expect(movePhotoToSection(items, "zz", "rt:rt1", defs)).toBe(items);
    expect(movePhotoToSection(items, "a", "nope", defs)).toBe(items);
  });
  it("appendPhotos no duplica ids", () => {
    expect(appendPhotos([photo("a")], [photo("a"), photo("b")]).map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("galleryOrder: secciones en orden del editor, sin clasificar al final, estable dentro de cada una", () => {
    const items = [
      photo("u1"),
      photo("gym", { ...assignmentFor("area:gimnasio", defs)! }),
      photo("fac", { ...assignmentFor("facade", defs)! }),
      photo("gym2", { ...assignmentFor("area:gimnasio", defs)! }),
    ];
    const order = galleryOrder(items, defs);
    const ids = [...order.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    expect(ids).toEqual(["fac", "gym", "gym2", "u1"]);
  });
});

describe("portada (hasta 5, con orden)", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i + 1}`));
  it("toggleCover agrega al final, renumera y respeta el tope de 5", () => {
    let items = mk(6);
    for (const id of ["p1", "p2", "p3", "p4", "p5"]) items = toggleCover(items, id);
    expect(coverPhotos(items).map((i) => i.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(coverPhotos(items).map((i) => i.coverOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(toggleCover(items, "p6")).toBe(items); // no entra una sexta
    const quitada = toggleCover(items, "p2");
    expect(coverPhotos(quitada).map((i) => [i.id, i.coverOrder])).toEqual([["p1", 1], ["p3", 2], ["p4", 3], ["p5", 4]]);
    expect(quitada.find((i) => i.id === "p2")).toMatchObject({ featured: false, coverOrder: null });
  });
  it("moveCover intercambia posiciones y no se sale de los bordes", () => {
    let items = mk(3);
    for (const id of ["p1", "p2", "p3"]) items = toggleCover(items, id);
    items = moveCover(items, "p3", -1);
    expect(coverPhotos(items).map((i) => i.id)).toEqual(["p1", "p3", "p2"]);
    expect(moveCover(items, "p1", -1)).toBe(items);
    expect(moveCover(items, "p2", 1)).toBe(items);
  });
  it("normalizeCover ordena las que no tenían orden al final y limpia las no destacadas", () => {
    const items = normalizeCover([photo("a", { featured: true }), photo("b", { featured: true, coverOrder: 1 }), photo("c", { coverOrder: 3 })]);
    expect(items.map((i) => i.coverOrder)).toEqual([2, 1, null]);
  });
});
