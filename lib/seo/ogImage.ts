import { OG_SIZE } from "@/lib/share/ogCard";

/**
 * Imagen de marca de la vista previa del link (la genera `app/opengraph-image.tsx`).
 * Next reemplaza `openGraph` entero por página: toda página que lo declare sin imagen propia tiene que repetir esta.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  ...OG_SIZE,
  type: "image/png",
  alt: "EstuRed: residencias estudiantiles en Buenos Aires",
};
