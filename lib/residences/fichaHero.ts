/**
 * Lógica pura del hero de la ficha («placa porteña», propuesta A): portada, textos de los botones y tamaño del nombre en la placa.
 * Sin dependencias de React ni de servidor, para poder testearla.
 */
import { pickRotationPhotos } from "@/lib/residences/photoMeta";

/**
 * Portada del hero: la primera de las fotos que rotan (destacadas en el orden elegido por la residencia; sin destacadas, la primera).
 * Es el mismo criterio de la imagen de vista previa del link (`lib/residences/sharePreview.ts`), para que link y página se vean iguales.
 */
export function pickHeroCover<T extends { featured: boolean; coverOrder?: number | null; sortOrder?: number }>(photos: T[]): T | null {
  return pickRotationPhotos(photos)[0] ?? null;
}

/** Texto del botón del visor de fotos del hero. Con 0 fotos no hay botón (`null`). */
export function photosButtonLabel(total: number): string | null {
  if (total <= 0) return null;
  return total === 1 ? "Ver la foto" : `Ver las ${total} fotos`;
}

/** Texto del botón de contorno de la franja «Lo esencial» que lleva a las preguntas frecuentes. */
export function faqChipLabel(count: number): string {
  if (count <= 0) return "Hacé una pregunta";
  return count === 1 ? "Leé la respuesta rápida" : `Leé las ${count} respuestas rápidas`;
}

/** Ancho de un carácter promedio del título en la placa (Bricolage Grotesque 700, tracking -0,035em), con margen para las letras anchas. */
const CHAR_EM = 0.58;
const TITLE_MIN_REM = 1.75;
const TITLE_MAX_PX = 120;
/** Ancho útil del título dentro de la placa: lo que ocupa su borde, su relleno y el doble filete (en rem, restado al ancho de la placa). */
const PLATE_INSET_REM = 4.25;
/** Ancho de lectura máximo de la placa (px) que se reparte entre los caracteres de la palabra más larga. */
const PLATE_MAX_INNER_PX = 680;

/** La palabra más larga del nombre (la que no se puede partir sin cortar letras). */
export function longestWord(name: string): number {
  return name
    .trim()
    .split(/\s+/)
    .reduce((max, w) => Math.max(max, w.length), 0);
}

/**
 * Tamaño (valor CSS de `font-size`) del nombre en la placa. Se calcula para que la PALABRA MÁS LARGA entre siempre en una línea
 * dentro del ancho de la placa (unidades `cqw` del contenedor que envuelve a la placa), con un tope en px para escritorio y un
 * mínimo legible. Nombres cortos salen grandes; nombres largos achican en vez de cortarse.
 */
export function plateTitleFontSize(name: string): string {
  const word = Math.max(longestWord(name), 1);
  const divisor = (word * CHAR_EM).toFixed(2);
  const maxPx = Math.min(TITLE_MAX_PX, Math.floor(PLATE_MAX_INNER_PX / (word * CHAR_EM)));
  return `clamp(${TITLE_MIN_REM}rem, calc((100cqw - ${PLATE_INSET_REM}rem) / ${divisor}), ${Math.max(maxPx, TITLE_MIN_REM * 16)}px)`;
}
