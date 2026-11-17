import { BUENOS_AIRES_UNIVERSITIES } from "@/lib/data/buenosAiresUniversities";

/**
 * Universidades que /search muestra siempre en la vista Mapa. Mismas coordenadas y misma lista que el resto de la app
 * (`lib/data/buenosAiresUniversities.ts`): acá solo se les agrega una categoría (color de pin), un nombre corto y dos
 * ajustes del mapa: (1) las que comparten sede van en un solo pin (Ciudad Universitaria + FADU) y (2) una facultad con
 * más de una sede tiene un pin por sede (Psicología). Los nombres de la lista de la app no cambian.
 */
export type UniversityCategory = "uba" | "public" | "private";

export const UNIVERSITY_CATEGORIES: Record<UniversityCategory, { label: string; pin: string; dot: string }> = {
  uba: { label: "UBA", pin: "bg-petrol-600", dot: "bg-petrol-600" },
  public: { label: "Otras públicas", pin: "bg-lilac-fg", dot: "bg-lilac-fg" },
  private: { label: "Privadas", pin: "bg-amber-soft-700", dot: "bg-amber-soft-700" },
};

/** Universidades públicas que no son UBA (el resto de la lista son privadas). */
const PUBLIC_NAMES = ["Universidad Tecnológica Nacional (UTN - FRBA)", "Universidad Nacional de las Artes (UNA)"];

/** Comparten sede: la clave se dibuja en el pin del valor. */
const SHARED_SITE: Record<string, string> = {
  "UBA - Facultad de Arquitectura, Diseño y Urbanismo (FADU)": "UBA - Ciudad Universitaria",
};

/** Sedes adicionales (Av. Independencia 3065 es la del dato base; esta es Hipólito Yrigoyen 3242, Balvanera). */
const EXTRA_SITES: Record<string, { site: string; lat: number; lng: number }> = {
  "UBA - Facultad de Psicología": { site: "Sede Hipólito Yrigoyen", lat: -34.6125, lng: -58.4123 },
};
const MAIN_SITE_LABEL: Record<string, string> = { "UBA - Facultad de Psicología": "Sede Independencia" };

export type UniversityPin = { id: string; label: string; short: string; lat: number; lng: number; category: UniversityCategory };
/** Fila de la referencia: lleva al pin `pinId`. */
export type UniversityLegendItem = { label: string; pinId: string; category: UniversityCategory };

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

const pins: UniversityPin[] = [];
const legend: UniversityLegendItem[] = [];

for (const u of BUENOS_AIRES_UNIVERSITIES) {
  const category = categoryOf(u.name);
  const hostName = SHARED_SITE[u.name];
  if (hostName) {
    // Su pin es el de la universidad que comparte sede: se agrega el nombre al pin y su propia fila a la referencia.
    const host = pins.find((p) => p.id === hostName);
    if (host) {
      host.label = `${host.label} / ${u.name}`;
      host.short = `${host.short} / ${shortUniversityName(u.name)}`;
      legend.push({ label: u.name, pinId: host.id, category });
      continue;
    }
  }
  const extra = EXTRA_SITES[u.name];
  if (extra) {
    pins.push({ id: u.name, label: `${u.name} (${MAIN_SITE_LABEL[u.name]})`, short: `${shortUniversityName(u.name)} · ${MAIN_SITE_LABEL[u.name]}`, lat: u.lat, lng: u.lng, category });
    pins.push({ id: `${u.name}|extra`, label: `${u.name} (${extra.site})`, short: `${shortUniversityName(u.name)} · ${extra.site}`, lat: extra.lat, lng: extra.lng, category });
    legend.push({ label: `${u.name} (${MAIN_SITE_LABEL[u.name]})`, pinId: u.name, category });
    legend.push({ label: `${u.name} (${extra.site})`, pinId: `${u.name}|extra`, category });
    continue;
  }
  pins.push({ id: u.name, label: u.name, short: shortUniversityName(u.name), lat: u.lat, lng: u.lng, category });
  legend.push({ label: u.name, pinId: u.name, category });
}

export const UNIVERSITY_PINS: UniversityPin[] = pins;
export const UNIVERSITY_LEGEND: UniversityLegendItem[] = legend;
/** Cantidad de universidades (no de pines ni de filas). */
export const UNIVERSITY_COUNT = BUENOS_AIRES_UNIVERSITIES.length;
