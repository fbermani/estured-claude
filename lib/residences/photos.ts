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

/** Tope de fotos por residencia (sin las rechazadas): protege el almacenamiento y el guardado de la clasificación (máx. 200 por envío). */
export const MAX_RESIDENCE_PHOTOS = 60;

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

/**
 * ¿Puede el dueño borrar una foto suya? (DR36). Una foto pendiente o de una residencia sin publicar se borra siempre: nunca fue pública o no
 * hay mínimo que cuidar. Una foto APROBADA de una residencia publicada solo se borra si después quedan al menos `MIN_PUBLISH_PHOTOS`
 * aprobadas. Devuelve el mensaje de error (voseo) o `null` si se puede.
 */
export function photoDeleteBlockedMessage(params: { published: boolean; photoStatus: string; approvedCount: number }): string | null {
  if (!params.published || params.photoStatus !== "approved") return null;
  if (params.approvedCount - 1 >= MIN_PUBLISH_PHOTOS) return null;
  return `Tu residencia está publicada y necesita al menos ${MIN_PUBLISH_PHOTOS} fotos aprobadas. Subí otra y, cuando el equipo la apruebe, vas a poder borrar esta.`;
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
