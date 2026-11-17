/**
 * Preguntas frecuentes destacadas de la ficha: lógica PURA de la selección (qué llega del formulario y si es válido). La escritura y el
 * permiso viven en `lib/faq/featured.ts`; la que vale es siempre la validación del servidor.
 *
 * Se pueden destacar las del catálogo que la residencia muestra (`catalog`, id `FAQ-NN`) y las preguntas libres ya respondidas (`free`, uuid).
 * Las 5 fijas del perfil no son filas y no se destacan. Máximo 6, con el orden elegido (la posición en la lista).
 */
import { FEATURED_FAQ_MAX } from "@/lib/residences/featuredFaq";

export type FeaturedRef = { kind: "catalog" | "free"; id: string };

export const FEATURED_REF_ID_MAX = 64;

export type ParsedFeaturedRefs = { ok: true; refs: FeaturedRef[] } | { ok: false; error: string };

/** Valida la lista que manda el cliente: forma, tipos, sin repetidos y hasta `FEATURED_FAQ_MAX`. El orden es el de la lista. */
export function parseFeaturedRefs(raw: unknown): ParsedFeaturedRefs {
  if (!Array.isArray(raw)) return { ok: false, error: "No pudimos leer tu selección. Recargá la página e intentá de nuevo." };
  if (raw.length > FEATURED_FAQ_MAX) {
    return { ok: false, error: `Podés destacar hasta ${FEATURED_FAQ_MAX} preguntas. Sacá alguna para elegir otra.` };
  }
  const refs: FeaturedRef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "No pudimos leer tu selección. Recargá la página e intentá de nuevo." };
    const { kind, id } = item as { kind?: unknown; id?: unknown };
    if ((kind !== "catalog" && kind !== "free") || typeof id !== "string" || id.trim() === "" || id.length > FEATURED_REF_ID_MAX) {
      return { ok: false, error: "No pudimos leer tu selección. Recargá la página e intentá de nuevo." };
    }
    const key = `${kind}:${id}`;
    if (seen.has(key)) return { ok: false, error: "Hay una pregunta repetida en tu selección." };
    seen.add(key);
    refs.push({ kind, id });
  }
  return { ok: true, refs };
}
