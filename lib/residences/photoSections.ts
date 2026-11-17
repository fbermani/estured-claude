/**
 * Modelo del editor de la galería de fotos (rediseño 2026-11-03). Funciones puras, sin dependencias de servidor: las usa el editor del owner
 * (cliente) y los tests. No hay schema propio: cada sección se guarda con los campos de `residence_photo_meta` (migraciones 0059 / 0070 / 0074):
 *   - «Sin clasificar» = foto general sin sección (lo que ya era cualquier foto recién subida).
 *   - «Fachada / Exterior» = category `area`, área `entrada`.
 *   - Áreas comunes elegidas = category `area` con el área que corresponda; «Sala de Juegos» y los ítems «Otro» (sin área propia en el modelo) = área `otra` + nombre de sección.
 *   - Tipos de habitación activos = category `room_type` + `room_type_id`.
 * Las secciones salen SOLO de lo que la residencia tiene hoy (fachada + áreas comunes + «Otro» + tipos activos). Una foto clasificada en algo que ya no existe
 * (área destacada, tipo desactivado o borrado, «Otro» no aprobado) no se pierde: cae en «Sin clasificar» en el editor y en «Fotos adicionales» en la ficha.
 */
import { MAX_FEATURED_PHOTOS, normalizeSection, type PhotoArea, type PhotoCategory } from "@/lib/residences/photoMeta";

export const UNSORTED_KEY = "unsorted";
export const FACADE_TITLE = "Fachada / Exterior";

export type PhotoSectionKind = "facade" | "area" | "room_type";

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
  /** Ítem «Otro» todavía sin aprobar: el dueño ya puede subirle fotos, pero la ficha pública no las muestra ahí hasta que se apruebe. */
  pending?: boolean;
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
  /** Foto principal (migración 0097): hero de la ficha y vista previa del link. Una sola por residencia. */
  isCover?: boolean;
};

/** Ítem «Otro» de tipo área común (`residence_custom_amenities`, kind `area`). */
export type CustomAreaInput = { label: string; status: "pending" | "approved" | "rejected" };

/**
 * Secciones, en el orden en que se muestran: Fachada / Exterior, las áreas comunes elegidas (en el orden de la lista fija), los ítems «Otro» de área
 * (aprobados y, para el editor, pendientes), y los tipos de habitación activos (en el orden recibido; si dos se llaman igual, se numeran).
 * Sin `sectionNamesReady` (migración 0070) no se puede guardar el nombre de sección: «Sala de Juegos» y los «Otro» no se ofrecen.
 */
export function buildPhotoSections(params: {
  commonAreas: string[];
  customAreas?: CustomAreaInput[];
  roomTypes: { id: string; name: string }[];
  sectionNamesReady: boolean;
}): PhotoSectionDef[] {
  const { commonAreas, customAreas = [], roomTypes, sectionNamesReady } = params;
  const named = (title: string) => (sectionNamesReady ? title : null);
  const defs: PhotoSectionDef[] = [
    { key: "facade", title: FACADE_TITLE, kind: "facade", icon: "home_work", assign: { category: "area", area: "entrada", roomTypeId: null, section: named(FACADE_TITLE) } },
  ];
  const usedAreas = new Set<PhotoArea>(["entrada"]);
  const usedTitles = new Set<string>([FACADE_TITLE.toLowerCase()]);
  for (const a of commonAreas) {
    const m = COMMON_AREA_PHOTO[a];
    if (!m) continue;
    if (m.custom) {
      if (!sectionNamesReady || usedTitles.has(a.toLowerCase())) continue;
      usedTitles.add(a.toLowerCase());
      defs.push({ key: `custom:${a.toLowerCase()}`, title: a, kind: "area", icon: m.icon, assign: { category: "area", area: m.area, roomTypeId: null, section: a } });
      continue;
    }
    if (usedAreas.has(m.area)) continue; // «Sala de Estudio» y «Área de Estudio» comparten sección
    usedAreas.add(m.area);
    usedTitles.add(a.toLowerCase());
    defs.push({ key: `area:${m.area}`, title: a, kind: "area", icon: m.icon, assign: { category: "area", area: m.area, roomTypeId: null, section: named(a) } });
  }
  if (sectionNamesReady) {
    for (const c of customAreas) {
      const label = normalizeSection(c.label);
      if (!label || c.status === "rejected" || usedTitles.has(label.toLowerCase())) continue;
      usedTitles.add(label.toLowerCase());
      defs.push({
        key: `custom:${label.toLowerCase()}`,
        title: label,
        kind: "area",
        icon: "add_photo_alternate",
        pending: c.status !== "approved",
        assign: { category: "area", area: "otra", roomTypeId: null, section: label },
      });
    }
  }
  const nameCount = new Map<string, number>();
  for (const rt of roomTypes) nameCount.set(rt.name.trim().toLowerCase(), (nameCount.get(rt.name.trim().toLowerCase()) ?? 0) + 1);
  const seenName = new Map<string, number>();
  for (const rt of roomTypes) {
    const k = rt.name.trim().toLowerCase();
    const n = (seenName.get(k) ?? 0) + 1;
    seenName.set(k, n);
    const title = `Habitación ${rt.name.trim()}${(nameCount.get(k) ?? 0) > 1 ? ` (${n})` : ""}`;
    defs.push({ key: `rt:${rt.id}`, title, kind: "room_type", icon: "bed", assign: { category: "room_type", area: null, roomTypeId: rt.id, section: named(title) } });
  }
  return defs;
}

/** En qué sección está una foto (`UNSORTED_KEY` si es general y sin sección, o si la clasificación que tenía ya no tiene sección: área o tipo que se sacó). */
export function sectionKeyOf(photo: PhotoAssignment, defs: PhotoSectionDef[]): string {
  const name = normalizeSection(photo.section)?.toLowerCase() ?? null;
  if (photo.category === "room_type") return defs.find((d) => d.kind === "room_type" && d.assign.roomTypeId === photo.roomTypeId)?.key ?? UNSORTED_KEY;
  if (photo.category === "area") {
    if (photo.area === "entrada") return "facade";
    if (photo.area === "otra") return defs.find((d) => d.key.startsWith("custom:") && d.title.toLowerCase() === name)?.key ?? UNSORTED_KEY;
    return defs.find((d) => d.kind === "area" && d.assign.area === photo.area && !d.key.startsWith("custom:"))?.key ?? UNSORTED_KEY;
  }
  // General: si el nombre de sección coincide con una sección actual, va ahí; si no, queda sin clasificar.
  if (name) {
    const byName = defs.find((d) => d.title.toLowerCase() === name);
    if (byName) return byName.key;
  }
  return UNSORTED_KEY;
}

/** ¿Tenía una clasificación que ya no tiene sección? (hoy está en «Sin clasificar» solo por eso). */
export function isOrphaned(photo: PhotoAssignment, defs: PhotoSectionDef[]): boolean {
  const classified = photo.category !== "general" || normalizeSection(photo.section) !== null;
  return classified && sectionKeyOf(photo, defs) === UNSORTED_KEY;
}

/** Lo que se guarda al mover una foto a una sección (o de vuelta a «Sin clasificar»). */
export function assignmentFor(key: string, defs: PhotoSectionDef[]): PhotoAssignment | null {
  if (key === UNSORTED_KEY) return { category: "general", area: null, roomTypeId: null, section: null };
  return defs.find((d) => d.key === key)?.assign ?? null;
}

/**
 * Clasificación vigente de una foto: la de la sección donde está hoy (con el nombre actual de la sección, así un tipo renombrado no queda con el viejo),
 * o «general» sin sección si ya no hay dónde ponerla. Es lo que usa la ficha pública; no se guarda (si el dueño vuelve a tildar el área, la foto vuelve).
 */
export function reconcileAssignment<T extends PhotoAssignment>(photo: T, defs: PhotoSectionDef[]): T {
  const a = assignmentFor(sectionKeyOf(photo, defs), defs);
  return a ? { ...photo, ...a } : photo;
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
