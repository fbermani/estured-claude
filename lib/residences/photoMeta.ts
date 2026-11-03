/**
 * Clasificación de fotos de residencia (DR18 fase 2, migración 0059). Funciones puras, sin dependencias de servidor:
 * las usan el editor del owner (cliente), la action de guardado, el catálogo, la ficha y el visor.
 */

export const MAX_FEATURED_PHOTOS = 5;

export type PhotoCategory = "general" | "area" | "room_type";

export const PHOTO_AREAS = [
  { value: "cocina", label: "Cocina" },
  { value: "bano", label: "Baño" },
  { value: "patio", label: "Patio" },
  { value: "terraza", label: "Terraza" },
  { value: "comedor", label: "Comedor" },
  { value: "living", label: "Living / sala común" },
  { value: "lavadero", label: "Lavadero" },
  { value: "gimnasio", label: "Gimnasio / área para ejercitar" },
  { value: "estudio", label: "Sala de estudio" },
  { value: "entrada", label: "Entrada / fachada" },
  { value: "otra", label: "Otra área" },
] as const;

export type PhotoArea = (typeof PHOTO_AREAS)[number]["value"];

const AREA_VALUES = new Set<string>(PHOTO_AREAS.map((a) => a.value));
const CATEGORY_VALUES = new Set<string>(["general", "area", "room_type"]);

export function areaLabel(area: string | null | undefined): string {
  return PHOTO_AREAS.find((a) => a.value === area)?.label ?? "Otra área";
}

/** Metadatos de una foto tal como los edita el owner. */
export type PhotoMetaInput = {
  fileId: string;
  category: PhotoCategory;
  area: PhotoArea | null;
  roomTypeId: string | null;
  featured: boolean;
  /** Sección con nombre (DR30, migración 0070); null = sugerida por área / tipo o «Fotos adicionales». */
  section: string | null;
  sortOrder: number;
  /** Posición (1..5) entre las de portada (migración 0074); null si no es destacada o no tiene orden elegido. */
  coverOrder: number | null;
};

export const MAX_SECTION_LENGTH = 40;
export const DEFAULT_SECTION = "Fotos adicionales";
export const SECTION_SUGGESTIONS = [
  "Living",
  "Cocina completa",
  "Comedor",
  "Dormitorio 1",
  "Dormitorio 2",
  "Baño completo",
  "Exterior",
  "Pileta",
  DEFAULT_SECTION,
] as const;

/** Normaliza el nombre de una sección: trim y espacios colapsados. Vacío → null. */
export function normalizeSection(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

export type PhotoMetaValidation =
  | { ok: true; items: PhotoMetaInput[] }
  | { ok: false; error: string };

/**
 * Valida (server-side) lo que llega del editor. `validFileIds` = fotos de ESTA residencia; `validRoomTypeIds` = tipos activos de ESTA residencia.
 * Normaliza: el área solo vive en `area`, el tipo solo en `room_type`.
 */
export function validatePhotoMeta(
  raw: unknown,
  ctx: { validFileIds: Set<string>; validRoomTypeIds: Set<string> },
): PhotoMetaValidation {
  if (!Array.isArray(raw)) return { ok: false, error: "No pudimos leer las fotos. Recargá la página y probá de nuevo." };
  if (raw.length > 200) return { ok: false, error: "Hay demasiadas fotos para guardar de una vez." };
  const seen = new Set<string>();
  const items: PhotoMetaInput[] = [];
  for (const entry of raw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const fileId = typeof e.fileId === "string" ? e.fileId : "";
    if (!ctx.validFileIds.has(fileId) || seen.has(fileId))
      return { ok: false, error: "Una de las fotos ya no existe en tu galería. Recargá la página y probá de nuevo." };
    seen.add(fileId);
    const category = typeof e.category === "string" && CATEGORY_VALUES.has(e.category) ? (e.category as PhotoCategory) : null;
    if (!category) return { ok: false, error: "Elegí una categoría válida para cada foto." };
    let area: PhotoArea | null = null;
    let roomTypeId: string | null = null;
    if (category === "area") {
      if (typeof e.area !== "string" || !AREA_VALUES.has(e.area))
        return { ok: false, error: "Elegí el área de las fotos marcadas como «Por área»." };
      area = e.area as PhotoArea;
    }
    if (category === "room_type") {
      if (typeof e.roomTypeId !== "string" || !ctx.validRoomTypeIds.has(e.roomTypeId))
        return { ok: false, error: "Elegí el tipo de habitación de las fotos marcadas como «Por tipo de habitación»." };
      roomTypeId = e.roomTypeId;
    }
    const section = normalizeSection(e.section);
    if (section && section.length > MAX_SECTION_LENGTH)
      return { ok: false, error: `El nombre de la sección puede tener hasta ${MAX_SECTION_LENGTH} caracteres.` };
    const sortOrder =
      typeof e.sortOrder === "number" && Number.isInteger(e.sortOrder) && e.sortOrder >= 0 && e.sortOrder <= 9999 ? e.sortOrder : 0;
    const coverOrder =
      typeof e.coverOrder === "number" && Number.isInteger(e.coverOrder) && e.coverOrder >= 1 && e.coverOrder <= 99 ? e.coverOrder : null;
    items.push({ fileId, category, area, roomTypeId, featured: e.featured === true, section, sortOrder, coverOrder });
  }
  const featured = items.filter((i) => i.featured);
  if (featured.length > MAX_FEATURED_PHOTOS)
    return { ok: false, error: `Podés elegir hasta ${MAX_FEATURED_PHOTOS} fotos de portada (las que rotan en tu ficha). Ahora tenés ${featured.length}.` };
  // El orden de portada se normaliza: 1..N sin repetidos (los sin orden van al final, en el orden recibido); las que no son de portada, null.
  featured
    .map((it, n) => ({ it, n }))
    .sort((a, b) => (a.it.coverOrder ?? 99) - (b.it.coverOrder ?? 99) || a.n - b.n)
    .forEach(({ it }, pos) => {
      it.coverOrder = pos + 1;
    });
  for (const it of items) if (!it.featured) it.coverOrder = null;
  return { ok: true, items };
}

/** Foto ya resuelta para mostrar. */
export type GalleryPhoto = {
  url: string;
  category: PhotoCategory;
  area: string | null;
  roomTypeName: string | null;
  featured: boolean;
  /** Sección con nombre elegida por la residencia (DR30). */
  section?: string | null;
  sortOrder?: number;
  /** Orden entre las de portada (migración 0074). */
  coverOrder?: number | null;
};

/** Sección efectiva: la elegida, o el área / tipo de habitación, o «Fotos adicionales». */
export function effectiveSection(p: Pick<GalleryPhoto, "section" | "category" | "area" | "roomTypeName">): string {
  const own = normalizeSection(p.section);
  if (own) return own;
  if (p.category === "area") return areaLabel(p.area);
  if (p.category === "room_type" && p.roomTypeName) return p.roomTypeName;
  return DEFAULT_SECTION;
}

/**
 * Agrupa por sección efectiva para el visor «Ver todas»: las fotos se ordenan por `sortOrder` (estable) y las secciones salen por
 * orden de primera aparición, con «Fotos adicionales» siempre al final. Sección = comparación sin distinguir mayúsculas.
 */
export function groupPhotosBySections<T extends Pick<GalleryPhoto, "section" | "category" | "area" | "roomTypeName" | "sortOrder">>(
  photos: T[],
): { key: string; title: string; photos: T[] }[] {
  const sorted = photos.map((p, i) => ({ p, i })).sort((a, b) => (a.p.sortOrder ?? 0) - (b.p.sortOrder ?? 0) || a.i - b.i);
  const groups = new Map<string, { key: string; title: string; photos: T[] }>();
  for (const { p } of sorted) {
    const title = effectiveSection(p);
    const key = title.toLowerCase();
    const g = groups.get(key) ?? { key, title, photos: [] };
    g.photos.push(p);
    groups.set(key, g);
  }
  const extra = DEFAULT_SECTION.toLowerCase();
  return [...groups.values()].sort((a, b) => Number(a.key === extra) - Number(b.key === extra));
}

/**
 * Las fotos que rotan: las de portada (hasta 5) o, si no hay, las primeras 5. Las de portada salen en el orden elegido por el owner
 * (`coverOrder`); sin orden, según el de la galería (`sortOrder`) y, a igualdad, el de llegada (orden estable).
 */
export function pickRotationPhotos<T extends { featured: boolean; coverOrder?: number | null; sortOrder?: number }>(photos: T[]): T[] {
  const featured = photos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.featured)
    .sort((a, b) => (a.p.coverOrder ?? 99) - (b.p.coverOrder ?? 99) || (a.p.sortOrder ?? 0) - (b.p.sortOrder ?? 0) || a.i - b.i)
    .slice(0, MAX_FEATURED_PHOTOS)
    .map(({ p }) => p);
  return featured.length > 0 ? featured : photos.slice(0, MAX_FEATURED_PHOTOS);
}

export type PhotoGroup = { key: string; title: string; photos: GalleryPhoto[] };

/** Agrupa para el visor: General, luego cada área, luego cada tipo de habitación (orden estable por aparición). */
export function groupGalleryPhotos(photos: GalleryPhoto[]): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();
  const put = (key: string, title: string, photo: GalleryPhoto) => {
    const g = groups.get(key) ?? { key, title, photos: [] };
    g.photos.push(photo);
    groups.set(key, g);
  };
  for (const p of photos) {
    if (p.category === "area") put(`area:${p.area}`, areaLabel(p.area), p);
    else if (p.category === "room_type") put(`rt:${p.roomTypeName ?? ""}`, p.roomTypeName ? `Habitación: ${p.roomTypeName}` : "Habitaciones", p);
    else put("general", "General", p);
  }
  const all = [...groups.values()];
  const rank = (k: string) => (k === "general" ? 0 : k.startsWith("area:") ? 1 : 2);
  return all.sort((a, b) => rank(a.key) - rank(b.key));
}
