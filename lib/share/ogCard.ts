/**
 * Pieza gráfica de la vista previa del link de la ficha (imagen Open Graph 1200×630, la que se ve al pegar el link en WhatsApp).
 * Funciones puras: tamaño del nombre en la placa, textos del precio y de la referencia en pesos. El JSX está en
 * `app/(public)/residencias/[slug]/_og/ShareCard.tsx` y la ruta en `opengraph-image.tsx`.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Ancho útil del nombre dentro de la placa (px). */
const PLATE_INNER_WIDTH = 748;
/** Ancho medio de un carácter de Bricolage 800, en em (medido sobre «Residencia Norte»). */
const CHAR_EM = 0.52;
const MAX_FONT = 108;
const MIN_FONT_ONE_LINE = 64;
const MIN_FONT = 52;

/** Tamaño del nombre y cuántas líneas ocupa: una sola línea hasta ~22 letras, después baja a dos líneas con un tamaño que entre. */
export function plateNameLayout(name: string): { fontSize: number; lines: 1 | 2 } {
  const len = Math.max(1, name.trim().length);
  const oneLine = Math.floor(PLATE_INNER_WIDTH / (len * CHAR_EM));
  if (oneLine >= MIN_FONT_ONE_LINE) return { fontSize: Math.min(MAX_FONT, oneLine), lines: 1 };
  const twoLines = Math.floor(PLATE_INNER_WIDTH / (Math.ceil(len / 2) * CHAR_EM));
  return { fontSize: Math.max(MIN_FONT, Math.min(MIN_FONT_ONE_LINE, twoLines)), lines: 2 };
}

/** «desde USD 190/mes». */
export function priceLabel(priceUsd: number): string {
  return `desde USD ${priceUsd.toLocaleString("es-AR")}/mes`;
}

/** Referencia en pesos (siempre acompaña al monto en USD): «$ 280.000 ARS · valor referencial». Sin «≈»: la fuente de la imagen no lo trae. */
export function arsReferenceLabel(priceArs: number): string {
  return `$ ${priceArs.toLocaleString("es-AR")} ARS · valor referencial`;
}
