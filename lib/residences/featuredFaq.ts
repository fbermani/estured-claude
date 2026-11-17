/**
 * Preguntas destacadas de la ficha (banda del capítulo «Preguntas que más nos hacen», propuesta A). Lógica pura.
 *
 * TRANSITORIO: la migración con `is_featured` / `featured_order` en las FAQ (SPEC, «Datos nuevos» punto 2) todavía no existe. Mientras
 * tanto, las destacadas son las primeras `FEATURED_FAQ_MAX` por el orden actual de la ficha (las del catálogo que la residencia eligió,
 * después las fijas del perfil y al final las libres respondidas). Cuando exista la columna, alcanza con que la página pase `isFeatured`
 * y `featuredOrder` en cada ítem: esta función ya los respeta (si la residencia marcó alguna, solo esas, en su orden y con el máximo).
 */
export const FEATURED_FAQ_MAX = 6;

export type FeaturableFaq = {
  /** Marcada por la residencia como destacada (futuro `is_featured`). Hoy la página no lo envía. */
  isFeatured?: boolean | null;
  /** Orden elegido por la residencia entre las destacadas (futuro `featured_order`). */
  featuredOrder?: number | null;
};

/**
 * Parte las preguntas en las destacadas (banda) y el resto (acordeón de «Más preguntas»). Ninguna pregunta se pierde ni se repite:
 * `featured` + `rest` son exactamente la lista original, y `rest` conserva su orden.
 */
export function splitFeaturedFaq<T extends object>(items: T[], max: number = FEATURED_FAQ_MAX): { featured: T[]; rest: T[] } {
  const limit = Math.max(0, Math.floor(max));
  const flags = (q: T): FeaturableFaq => q;
  const marked = items.filter((q) => flags(q).isFeatured === true);
  let featured: T[];
  if (marked.length > 0) {
    featured = marked
      .map((q, i) => ({ q, i }))
      .sort((a, b) => (flags(a.q).featuredOrder ?? Number.MAX_SAFE_INTEGER) - (flags(b.q).featuredOrder ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
      .slice(0, limit)
      .map(({ q }) => q);
  } else {
    featured = items.slice(0, limit);
  }
  const taken = new Set<T>(featured);
  return { featured, rest: items.filter((q) => !taken.has(q)) };
}
