/**
 * Mosaico de «Vivir acá» (propuesta A): una foto grande y dos chicas con rótulo («Patio con parrilla», «Cocina», «+ 21 fotos»), debajo de
 * la descripción. Lógica pura: qué fotos entran y qué rótulo lleva cada una. La portada ya se ve en el hero, así que se elige entre las
 * demás (solo se repite si no queda otra). Se prefieren las fotos de áreas comunes, de secciones distintas, para que el mosaico muestre
 * variedad y no tres fotos del mismo cuarto.
 */
import { DEFAULT_SECTION, effectiveSection, pickRotationPhotos, type GalleryPhoto } from "@/lib/residences/photoMeta";

/** Rótulo de una foto sin sección ni área (cae en «Fotos adicionales»): no sirve como pie de foto. */
export const GENERIC_CAPTION = "La casa";

/** Cantidad de tarjetas del mosaico cuando hay menos de 2 fotos: 1 grande + 2 chicas, las que faltan van vacías. */
export const MOSAIC_SLOTS = 3;
/** Rótulo de la tarjeta grande vacía y de las chicas vacías (más corto, para que no se corte en el celular). */
export const EMPTY_BIG_LABEL = "Fotos próximamente";
export const EMPTY_SMALL_LABEL = "Próximamente";

export type MosaicTile = {
  photo: GalleryPhoto;
  /** Pie de foto visible sobre la tarjeta. */
  caption: string;
  /** Esta tarjeta cierra el mosaico con «+ N fotos» y abre el visor desde la primera. */
  more: boolean;
};

export function tileCaption(photo: GalleryPhoto): string {
  const section = effectiveSection(photo);
  return section === DEFAULT_SECTION ? GENERIC_CAPTION : section;
}

export function moreLabel(remaining: number): string {
  return `+ ${remaining} ${remaining === 1 ? "foto" : "fotos"}`;
}

const rank = (p: GalleryPhoto) => (p.category === "area" ? 0 : p.category === "general" ? 1 : 2);

/** Hasta 3 fotos para el mosaico. Con menos de 2 fotos devuelve `[]`: el mosaico se completa con `buildMosaicSlots`. */
export function pickMosaicTiles(photos: GalleryPhoto[]): MosaicTile[] {
  if (photos.length < 2) return [];
  const cover = pickRotationPhotos(photos)[0] ?? photos[0];
  const rest = photos.filter((p) => p !== cover);
  const ordered = rest
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p);
  // Una por sección mientras haya (variedad); luego las repetidas, después las fotos de habitaciones (tienen su propio lugar en las
  // tarjetas de tipos) y, al final, la portada.
  const nonRoom = ordered.filter((p) => p.category !== "room_type");
  const rooms = ordered.filter((p) => p.category === "room_type");
  const seen = new Set<string>();
  const distinct: GalleryPhoto[] = [];
  const leftovers: GalleryPhoto[] = [];
  for (const p of nonRoom) {
    const key = effectiveSection(p).toLowerCase();
    if (seen.has(key)) leftovers.push(p);
    else {
      seen.add(key);
      distinct.push(p);
    }
  }
  const picked = [...distinct, ...leftovers, ...rooms, cover].slice(0, Math.min(3, photos.length));
  const remaining = photos.length - picked.length;
  return picked.map((photo, i) => {
    const more = i === picked.length - 1 && remaining > 0;
    return { photo, caption: more ? moreLabel(remaining) : tileCaption(photo), more };
  });
}

/** Una tarjeta del mosaico: con foto o vacía (todavía sin fotos; no se puede abrir ni promete nada). */
export type MosaicSlot = { kind: "photo"; tile: MosaicTile } | { kind: "empty" };

/**
 * Las 3 tarjetas del mosaico (1 grande + 2 chicas) para cualquier cantidad de fotos. Con 2 o más, las elegidas por `pickMosaicTiles` (2 fotos:
 * 2 tarjetas, como siempre). Con 1: esa foto en la grande y 2 vacías. Con 0: 3 vacías. Así la estructura de la ficha se ve siempre.
 */
export function buildMosaicSlots(photos: GalleryPhoto[]): MosaicSlot[] {
  if (photos.length >= 2) return pickMosaicTiles(photos).map((tile) => ({ kind: "photo", tile }));
  const slots: MosaicSlot[] = photos.map((photo) => ({ kind: "photo", tile: { photo, caption: tileCaption(photo), more: false } }));
  while (slots.length < MOSAIC_SLOTS) slots.push({ kind: "empty" });
  return slots;
}

/** Aclaración para lectores de pantalla cuando el mosaico tiene tarjetas vacías (una sola línea, sin prometer fotos). */
export function emptyMosaicNote(photoCount: number): string {
  return photoCount === 0 ? "Esta residencia todavía no subió fotos." : "Esta residencia todavía no subió más fotos.";
}

/** Texto del pill que abre el visor con todas las fotos. Solo se dibuja con 1 o más fotos. */
export function allPhotosLabel(total: number): string {
  return total === 1 ? "Ver la foto" : `Ver todas las fotos (${total})`;
}
