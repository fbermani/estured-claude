/**
 * Reglas de fotos de una residencia (Ciclo 54, D12). Funciones puras, sin
 * dependencias: las usan la action de aprobación (server), el perfil de la
 * residencia, el panel admin y el hero de la ficha.
 *
 * Política del dueño: EstuRed no usa fotos de terceros. Para publicar una
 * residencia hacen falta al menos 3 fotos propias cargadas; mientras no las
 * haya, la interfaz muestra un placeholder de marca.
 */

/** Mínimo de fotos propias (aprobadas) para poder publicar una residencia. */
export const MIN_PUBLISH_PHOTOS = 3;

/** Cuántas fotos faltan para llegar al mínimo (0 si ya alcanza). */
export function photosMissingForPublish(count: number): number {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return Math.max(0, MIN_PUBLISH_PHOTOS - safe);
}

/** ¿Cumple el mínimo de fotos para publicar? */
export function hasEnoughPhotosToPublish(count: number): boolean {
  return photosMissingForPublish(count) === 0;
}

/**
 * Mensaje (voseo) para el admin cuando intenta aprobar sin el mínimo de
 * fotos; `null` si alcanza.
 */
export function publishPhotosError(count: number): string | null {
  const missing = photosMissingForPublish(count);
  if (missing === 0) return null;
  const safe = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return `No se puede publicar: la residencia tiene ${safe} ${safe === 1 ? "foto propia" : "fotos propias"} y hacen falta al menos ${MIN_PUBLISH_PHOTOS}. Pedile que cargue ${missing === 1 ? "la que falta" : `las ${missing} que faltan`} desde su perfil y volvé a aprobarla.`;
}

/** Variante del hero de la ficha según la cantidad de fotos. */
export type GalleryLayout = "empty" | "single" | "mosaic" | "mosaic-more";

/**
 * 0 → placeholder grande · 1 → imagen única · 2–4 → mosaico ·
 * 5 o más → mosaico con "Ver todas".
 */
export function getGalleryLayout(count: number): GalleryLayout {
  const safe = Number.isFinite(count) ? Math.floor(count) : 0;
  if (safe <= 0) return "empty";
  if (safe === 1) return "single";
  if (safe <= 4) return "mosaic";
  return "mosaic-more";
}
