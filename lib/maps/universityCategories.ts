/**
 * Clasificación de las universidades en tres grupos (UBA · otras públicas · privadas). Fuente única: la usan el mapa de /search
 * (`lib/maps/universityPins.ts`, que la re-exporta) y el listado de proximidad de la configuración de residencia
 * (`lib/residences/universityGroups.ts`). Módulo chico y puro, sin los datos de pines.
 */
export type UniversityCategory = "uba" | "public" | "private";

export const UNIVERSITY_CATEGORIES: Record<UniversityCategory, { label: string; pin: string; dot: string }> = {
  uba: { label: "UBA", pin: "bg-petrol-600", dot: "bg-petrol-600" },
  public: { label: "Otras públicas", pin: "bg-lilac-fg", dot: "bg-lilac-fg" },
  private: { label: "Privadas", pin: "bg-amber-soft-700", dot: "bg-amber-soft-700" },
};

/** Universidades e institutos públicos que no son UBA (el resto de la lista son privados). */
const PUBLIC_NAMES = [
  "Universidad Tecnológica Nacional (UTN - FRBA)",
  "Universidad Nacional de las Artes (UNA)",
  "Universidad de la Defensa Nacional (UNDEF)",
  "Universidad Pedagógica Nacional (UNIPE)",
  "Universidad Nacional de Tres de Febrero (UNTREF)",
  "Universidad Nacional de San Martín (UNSAM)",
  "Universidad de la Ciudad de Buenos Aires (UniCABA)",
  "Instituto Universitario de la Policía Federal (IUPFA)",
  "Instituto Universitario de Gendarmería Nacional (IUGNA)",
  "Instituto Universitario de Seguridad (IUSE)",
  "Instituto Universitario Nacional de Derechos Humanos (IUNMa)",
];

/** Orden de las categorías en la lista y en la numeración. */
export const UNIVERSITY_CATEGORY_ORDER: UniversityCategory[] = ["uba", "public", "private"];

/** Categoría de una universidad por su nombre de la lista (UBA · otras públicas · privadas; lo desconocido cuenta como privada). */
export function universityCategory(name: string): UniversityCategory {
  if (name.startsWith("UBA")) return "uba";
  return PUBLIC_NAMES.includes(name) ? "public" : "private";
}
