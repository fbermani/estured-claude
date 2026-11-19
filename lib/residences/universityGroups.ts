import { UNIVERSITY_OTHER_NAME } from "@/lib/data/buenosAiresUniversities";
import { UNIVERSITY_CATEGORIES, UNIVERSITY_CATEGORY_ORDER, universityCategory, type UniversityCategory } from "@/lib/maps/universityCategories";

/**
 * Listado de proximidad a universidades de la configuración de residencia, dividido en las mismas tres secciones que el mapa de /search
 * (UBA · otras públicas · privadas). La clasificación NO se duplica: sale de `universityCategory`. El valor guardado no cambia
 * (sigue siendo el nombre de la universidad); esto solo ordena lo que se dibuja. Lógica pura.
 */
export type UniversityGroup = { key: UniversityCategory; label: string; names: string[] };

/** Comparación alfabética en español, sin distinguir mayúsculas ni tildes. */
const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

/**
 * Parte las opciones en tres grupos con sus nombres en orden alfabético. «Otra universidad o instituto» no pertenece a ningún grupo
 * (no es una institución): queda aparte en `other`, `null` si la lista no la trae.
 */
export function groupUniversityOptions(options: readonly string[]): { groups: UniversityGroup[]; other: string | null } {
  const buckets = new Map<UniversityCategory, string[]>(UNIVERSITY_CATEGORY_ORDER.map((c) => [c, []]));
  let other: string | null = null;
  for (const name of options) {
    if (name === UNIVERSITY_OTHER_NAME) {
      other = name;
      continue;
    }
    buckets.get(universityCategory(name))?.push(name);
  }
  const groups = UNIVERSITY_CATEGORY_ORDER.map((key) => ({ key, label: UNIVERSITY_CATEGORIES[key].label, names: (buckets.get(key) ?? []).sort(byName) }));
  return { groups, other };
}

/** Cuántas de las `selected` hay en `names`. */
export function countSelected(names: readonly string[], selected: ReadonlySet<string>): number {
  let n = 0;
  for (const name of names) if (selected.has(name)) n += 1;
  return n;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** ¿`name` coincide con lo buscado? Cada palabra buscada tiene que estar en el nombre (sin distinguir mayúsculas ni tildes). Vacío = todos. */
export function matchesUniversityQuery(name: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(name);
  return words.every((w) => haystack.includes(w));
}

/** Secciones que arrancan abiertas: las que ya tienen algo elegido. Se calcula una sola vez al montar (después solo se abre a mano o por búsqueda). */
export function initiallyOpenGroups(groups: readonly UniversityGroup[], selected: ReadonlySet<string>): Set<UniversityCategory> {
  return new Set(groups.filter((g) => countSelected(g.names, selected) > 0).map((g) => g.key));
}
