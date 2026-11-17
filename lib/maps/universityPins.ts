import { BUENOS_AIRES_UNIVERSITIES, type BuenosAiresUniversity } from "@/lib/data/buenosAiresUniversities";

/**
 * Universidades que /search muestra siempre en la vista Mapa. Mismas coordenadas y misma lista que el resto de la app
 * (`lib/data/buenosAiresUniversities.ts`): acá solo se les agrega una categoría (color de pin) y un nombre corto.
 */
export type UniversityCategory = "uba" | "public" | "private";

export const UNIVERSITY_CATEGORIES: Record<UniversityCategory, { label: string; pin: string; dot: string }> = {
  uba: { label: "UBA", pin: "bg-petrol-600", dot: "bg-petrol-600" },
  public: { label: "Otras públicas", pin: "bg-lilac-fg", dot: "bg-lilac-fg" },
  private: { label: "Privadas", pin: "bg-amber-soft-700", dot: "bg-amber-soft-700" },
};

/** Universidades públicas que no son UBA (el resto de la lista son privadas). */
const PUBLIC_NAMES = ["Universidad Tecnológica Nacional (UTN - FRBA)", "Universidad Nacional de las Artes (UNA)"];

export type UniversityPin = BuenosAiresUniversity & { category: UniversityCategory; short: string };

function categoryOf(name: string): UniversityCategory {
  if (name.startsWith("UBA")) return "uba";
  return PUBLIC_NAMES.includes(name) ? "public" : "private";
}

/** «UBA - Facultad de Derecho» → «UBA · Derecho»; «Universidad Católica Argentina (UCA)» → «UCA». */
export function shortUniversityName(name: string): string {
  if (name.startsWith("UBA - ")) {
    const rest = name.slice(6);
    const acronym = rest.match(/\(([^)]+)\)\s*$/);
    if (acronym) return `UBA · ${acronym[1]}`;
    return `UBA · ${rest.replace(/^Facultad de /, "")}`;
  }
  const acronym = name.match(/\(([^)]+)\)\s*$/);
  return acronym ? acronym[1] : name;
}

export const UNIVERSITY_PINS: UniversityPin[] = BUENOS_AIRES_UNIVERSITIES.map((u) => ({
  ...u,
  category: categoryOf(u.name),
  short: shortUniversityName(u.name),
}));
