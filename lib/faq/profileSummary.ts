/**
 * Resumen del catálogo de preguntas frecuentes para la tarjeta «Preguntas frecuentes» de la configuración de residencia.
 * Puro y sin `server-only`: parte de lo que ya cargan `loadCatalogForResidence` y `loadFeaturedCandidates`.
 * Tres números distintos, que no se mezclan: preguntas elegidas (recomendadas `FICHA_FAQ_VISIBLE`), esenciales listas
 * (`ESSENTIAL_FAQ_IDS`) y destacadas (`FEATURED_FAQ_MAX`, se ven primero en la ficha).
 */
import { ESSENTIAL_FAQ_IDS, FICHA_FAQ_VISIBLE, countEssentialFaqsReady, type CatalogSelection, type FaqOwner } from "@/lib/faq/catalog";
import { FEATURED_FAQ_MAX } from "@/lib/residences/featuredFaq";

export type FaqProfileSummary = {
  /** Preguntas del catálogo que la residencia eligió mostrar. */
  selected: number;
  recommended: number;
  essentialReady: number;
  essentialTotal: number;
  /** Destacadas elegidas; `null` si no se pudo leer (migración 0096 sin aplicar o error): no se muestra como 0. */
  featured: number | null;
  featuredMax: number;
};

type CatalogEntryLike = { id: string; owner: FaqOwner; suggested_answer: string; selection?: CatalogSelection | null };
type CatalogLoadLike = { ok: true; entries: CatalogEntryLike[] } | { ok: false };
type FeaturedLoadLike = { ok: true; candidates: { order: number | null }[] } | { ok: false };

/** `null` si el catálogo no se pudo cargar (la tarjeta dice «no disponible» en vez de mostrar ceros). */
export function buildFaqProfileSummary(catalog: CatalogLoadLike, featured: FeaturedLoadLike): FaqProfileSummary | null {
  if (!catalog.ok) return null;
  return {
    selected: catalog.entries.filter((e) => e.selection?.is_selected).length,
    recommended: FICHA_FAQ_VISIBLE,
    essentialReady: countEssentialFaqsReady(catalog.entries),
    essentialTotal: ESSENTIAL_FAQ_IDS.length,
    featured: featured.ok ? featured.candidates.filter((c) => c.order !== null).length : null,
    featuredMax: FEATURED_FAQ_MAX,
  };
}
