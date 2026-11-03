/**
 * Modelo del editor de la galería de fotos (rediseño 2026-11-03). Funciones puras, sin dependencias de servidor: las usa el editor del owner
 * (cliente) y los tests. No hay schema propio: cada sección se guarda con los campos de `residence_photo_meta` (migraciones 0059 / 0070 / 0074):
 *   - «Sin clasificar» = foto general sin sección (lo que ya era cualquier foto recién subida).
 *   - «Fachada / Exterior» = category `area`, área `entrada`.
 *   - Áreas comunes elegidas = category `area` con el área que corresponda; «Sala de Juegos» (sin área propia en el modelo) = área `otra` + nombre de sección.
 *   - Tipos de habitación creados = category `room_type` + `room_type_id`.
 *   - «Otras» = category `area`, área `otra` (y lo que quedó huérfano: p. ej. un área común que ya no está elegida).
 */
import { MAX_FEATURED_PHOTOS, areaLabel, normalizeSection, type PhotoArea, type PhotoCategory } from "@/lib/residences/photoMeta";

export const UNSORTED_KEY = "unsorted";
export const FACADE_TITLE = "Fachada / Exterior";
export const OTHER_TITLE = "Otras";

export type PhotoSectionKind = "facade" | "area" | "room_type" | "other";

export type PhotoAssignment = {
  category: PhotoCategory;
  area: PhotoArea | null;
  roomTypeId: string | null;
  section: string | null;
};

export type PhotoSectionDef = {
  key: string;
  title: string;
  kind: PhotoSectionKind;
  /** Nombre del ícono Material Symbols. */
  icon: string;
  assign: PhotoAssignment;
};

/** Área común (texto de `COMMON_AREA_OPTIONS`) → cómo se guarda la foto. `custom`: sin área propia en el modelo, se distingue por nombre de sección. */
const COMMON_AREA_PHOTO: Record<string, { area: PhotoArea; icon: string; custom?: boolean }> = {
  "Sala de Estar": { area: "living", icon: "weekend" },
  "Sala de Estudio": { area: "estudio", icon: "menu_book" },
  "Área de Estudio": { area: "estudio", icon: "menu_book" },
  Comedor: { area: "comedor", icon: "restaurant" },
  Patio: { area: "patio", icon: "yard" },
  Terraza: { area: "terraza", icon: "deck" },
  "Sala de Juegos": { area: "otra", icon: "sports_esports", custom: true },
  Gimnasio: { area: "gimnasio", icon: "fitness_center" },
  "Cocina compartida": { area: "cocina", icon: "kitchen" },
};

const AREA_ICON: Partial<Record<PhotoArea, string>> = {
  cocina: "kitchen",
  bano: "bathtub",
  patio: "yard",
  terraza: "deck",
  comedor: "restaurant",
  living: "weekend",
  lavadero: "local_laundry_service",
  gimnasio: "fitness_center",
  estudio: "menu_book",
};

/** Lo mínimo que se necesita de una foto para ubicarla. */
export type SectionedPhoto = PhotoAssignment & { id: string };

/** Foto tal como la maneja el editor (viene de la página del perfil o de la subida). */
export type PhotoMetaItem = SectionedPhoto & {
  url: string;
  /** `files.status = 'pending_review'`: todavía no la ve el público. */
  pending: boolean;
  featured: boolean;
  sortOrder: number;
  coverOrder: number | null;
};

/**
 * Secciones del editor, en el orden en que se muestran: Fachada / Exterior, las áreas comunes elegidas, los tipos de habitación y «Otras».
 * `existing` = fotos ya cargadas: si alguna está clasificada en un área que ya no está elegida (p. ej. «Baño», «Lavadero»), esa área se mantiene como sección.
 * Sin `sectionNamesReady` (migración 0070) no se puede guardar el nombre de sección: «Sala de Juegos» no se ofrece y queda dentro de «Otras».
 */
export function buildPhotoSections(params: {
  commonAreas: string[];
  roomTypes: { id: string; name: string }[];
  existing?: PhotoAssignment[];
  sectionNamesReady: boolean;
}): PhotoSectionDef[] {
  const { commonAreas, roomTypes, existing = [], sectionNamesReady } = params;
  const named = (title: string) => (sectionNamesReady ? title : null);
  const defs: PhotoSectionDef[] = [
    { key: "facade", title: FACADE_TITLE, kind: "facade", icon: "home_work", assign: { category: "area", area: "entrada", roomTypeId: null, section: named(FACADE_TITLE) } },
  ];
  const usedAreas = new Set<PhotoArea>(["entrada"]);
  for (const a of commonAreas) {
    const m = COMMON_AREA_PHOTO[a];
    if (!m) continue;
    if (m.custom) {
      if (!sectionNamesReady) continue;
      defs.push({ key: `custom:${a.toLowerCase()}`, title: a, kind: "area", icon: m.icon, assign: { category: "area", area: m.area, roomTypeId: null, section: a } });
      continue;
    }
    if (usedAreas.has(m.area)) continue; // «Sala de Estudio» y «Área de Estudio» comparten sección
    usedAreas.add(m.area);
    defs.push({ key: `area:${m.area}`, title: a, kind: "area", icon: m.icon, assign: { category: "area", area: m.area, roomTypeId: null, section: named(a) } });
  }
  for (const e of existing) {
    if (e.category !== "area" || !e.area || e.area === "otra" || usedAreas.has(e.area)) continue;
    usedAreas.add(e.area);
    const title = areaLabel(e.area);
    defs.push({ key: `area:${e.area}`, title, kind: "area", icon: AREA_ICON[e.area] ?? "photo_library", assign: { category: "area", area: e.area, roomTypeId: null, section: named(title) } });
  }
  for (const rt of roomTypes) {
    const title = `Habitación ${rt.name}`;
    defs.push({ key: `rt:${rt.id}`, title, kind: "room_type", icon: "bed", assign: { category: "room_type", area: null, roomTypeId: rt.id, section: named(title) } });
  }
  defs.push({ key: "other", title: OTHER_TITLE, kind: "other", icon: "photo_library", assign: { category: "area", area: "otra", roomTypeId: null, section: named(OTHER_TITLE) } });
  return defs;
}

/** En qué sección está una foto (`UNSORTED_KEY` si es general y sin sección). Lo clasificado que ya no tiene sección propia cae en «Otras». */
export function sectionKeyOf(photo: PhotoAssignment, defs: PhotoSectionDef[]): string {
  const name = normalizeSection(photo.section)?.toLowerCase() ?? null;
  if (photo.category === "room_type") return defs.find((d) => d.kind === "room_type" && d.assign.roomTypeId === photo.roomTypeId)?.key ?? "other";
  if (photo.category === "area") {
    if (photo.area === "entrada") return "facade";
    if (photo.area === "otra") return defs.find((d) => d.key.startsWith("custom:") && d.title.toLowerCase() === name)?.key ?? "other";
    return defs.find((d) => d.kind === "area" && d.assign.area === photo.area && !d.key.startsWith("custom:"))?.key ?? "other";
  }
  // General: si el nombre de sección coincide con una sección actual, va ahí; si no, queda sin clasificar.
  if (name) {
    const byName = defs.find((d) => d.title.toLowerCase() === name);
    if (byName) return byName.key;
  }
  return UNSORTED_KEY;
}

/** Lo que se guarda al mover una foto a una sección (o de vuelta a «Sin clasificar»). */
export function assignmentFor(key: string, defs: PhotoSectionDef[]): PhotoAssignment | null {
  if (key === UNSORTED_KEY) return { category: "general", area: null, roomTypeId: null, section: null };
  return defs.find((d) => d.key === key)?.assign ?? null;
}

/** Mueve una foto a otra sección: cambia su clasificación y la deja al final de la sección. */
export function movePhotoToSection<T extends SectionedPhoto>(items: T[], id: string, key: string, defs: PhotoSectionDef[]): T[] {
  const assign = assignmentFor(key, defs);
  const photo = items.find((i) => i.id === id);
  if (!assign || !photo) return items;
  return [...items.filter((i) => i.id !== id), { ...photo, ...assign }];
}

/** Agrega fotos recién subidas al final (sin duplicar ids). */
export function appendPhotos<T extends { id: string }>(items: T[], added: T[]): T[] {
  const have = new Set(items.map((i) => i.id));
  return [...items, ...added.filter((a) => !have.has(a.id))];
}

/** Posición de cada foto en la galería: por sección en el orden del editor y «Sin clasificar» al final; dentro de cada una, el orden del arreglo. */
export function galleryOrder(items: SectionedPhoto[], defs: PhotoSectionDef[]): Map<string, number> {
  const keys = [...defs.map((d) => d.key), UNSORTED_KEY];
  const rank = new Map(keys.map((k, i) => [k, i]));
  const sorted = items
    .map((it, n) => ({ id: it.id, r: rank.get(sectionKeyOf(it, defs)) ?? keys.length, n }))
    .sort((a, b) => a.r - b.r || a.n - b.n);
  return new Map(sorted.map((s, pos) => [s.id, pos]));
}

type CoverItem = { id: string; featured: boolean; coverOrder: number | null };

/** Normaliza el orden de portada: las destacadas quedan 1..N (sin repetidos, las sin orden al final) y el resto en null. */
export function normalizeCover<T extends CoverItem>(items: T[]): T[] {
  const featured = items
    .map((it, n) => ({ it, n }))
    .filter(({ it }) => it.featured)
    .sort((a, b) => (a.it.coverOrder ?? 99) - (b.it.coverOrder ?? 99) || a.n - b.n);
  const pos = new Map(featured.map(({ it }, i) => [it.id, i + 1]));
  return items.map((it) => ({ ...it, coverOrder: it.featured ? (pos.get(it.id) ?? null) : null }));
}

/** Marca o desmarca una foto como portada (tope `MAX_FEATURED_PHOTOS`); al marcar queda última en el orden. Si no entra, devuelve los mismos ítems. */
export function toggleCover<T extends CoverItem>(items: T[], id: string): T[] {
  const photo = items.find((i) => i.id === id);
  if (!photo) return items;
  if (!photo.featured && items.filter((i) => i.featured).length >= MAX_FEATURED_PHOTOS) return items;
  return normalizeCover(items.map((i) => (i.id === id ? { ...i, featured: !i.featured, coverOrder: i.featured ? null : 99 } : i)));
}

/** Sube o baja una foto de portada una posición dentro del orden de portada. */
export function moveCover<T extends CoverItem>(items: T[], id: string, dir: -1 | 1): T[] {
  const cover = normalizeCover(items)
    .filter((i) => i.featured)
    .sort((a, b) => (a.coverOrder ?? 0) - (b.coverOrder ?? 0));
  const idx = cover.findIndex((i) => i.id === id);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= cover.length) return items;
  const a = cover[idx];
  const b = cover[to];
  return normalizeCover(
    items.map((i) => (i.id === a.id ? { ...i, coverOrder: b.coverOrder } : i.id === b.id ? { ...i, coverOrder: a.coverOrder } : i)),
  );
}

/** Fotos de portada en el orden elegido. */
export function coverPhotos<T extends CoverItem>(items: T[]): T[] {
  return normalizeCover(items)
    .filter((i) => i.featured)
    .sort((a, b) => (a.coverOrder ?? 0) - (b.coverOrder ?? 0));
}
