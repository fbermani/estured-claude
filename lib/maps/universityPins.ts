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

/** Comparten sede: la clave se dibuja en el pin del valor (la Ciudad Universitaria reúne FADU y Exactas). */
const SHARED_SITE: Record<string, string> = {
  "UBA - Facultad de Arquitectura, Diseño y Urbanismo (FADU)": "UBA - Ciudad Universitaria",
  "UBA - Facultad de Ciencias Exactas y Naturales": "UBA - Ciudad Universitaria",
};

type Site = { site: string; lat: number; lng: number };

/** Sedes adicionales de una misma institución (la sede principal es la coordenada de la lista base). */
const EXTRA_SITES: Record<string, { main: string; sites: Site[] }> = {
  "UBA - Facultad de Psicología": {
    main: "Sede Independencia",
    sites: [{ site: "Sede Hipólito Yrigoyen", lat: -34.6125, lng: -58.4123 }],
  },
  "UBA - Facultad de Ingeniería": {
    main: "Sede Paseo Colón",
    sites: [{ site: "Sede Las Heras", lat: -34.5888, lng: -58.3966 }],
  },
  "Universidad Tecnológica Nacional (UTN - FRBA)": {
    main: "Sede Medrano",
    sites: [{ site: "Campus Mozart", lat: -34.6596, lng: -58.4678 }],
  },
  "Universidad Nacional de las Artes (UNA)": {
    main: "Rectorado",
    sites: [
      { site: "Rectorado (Anexo Investigación y Extensión)", lat: -34.6059, lng: -58.3908 },
      { site: "Artes Visuales (Sede Central)", lat: -34.5906, lng: -58.3929 },
      { site: "Artes Visuales (Sede Huergo)", lat: -34.6231, lng: -58.3662 },
      { site: "Artes Visuales (Sede Quinquela Martín)", lat: -34.6366, lng: -58.3694 },
      { site: "Artes Musicales y Sonoras (DAMuS)", lat: -34.5992, lng: -58.4021 },
      { site: "Artes Dramáticas (Sede French)", lat: -34.5831, lng: -58.4143 },
      { site: "Artes Dramáticas (Sede Venezuela)", lat: -34.6149, lng: -58.4023 },
      { site: "Artes Audiovisuales (Sede Rocamora)", lat: -34.5995, lng: -58.4239 },
      { site: "Artes Audiovisuales (Sede Salguero)", lat: -34.6111, lng: -58.4216 },
      { site: "Artes del Movimiento", lat: -34.6315, lng: -58.3621 },
      { site: "Artes Multimediales", lat: -34.6331, lng: -58.3596 },
      { site: "Folklore", lat: -34.6161, lng: -58.4139 },
      { site: "Crítica de Artes", lat: -34.6078, lng: -58.3931 },
      { site: "Formación Docente", lat: -34.6269, lng: -58.3728 },
      { site: "Museo de la Cárcova", lat: -34.6186, lng: -58.3563 },
    ],
  },
};

/** `n`: número de referencia (1…) que se dibuja en el pin y en la lista; se asigna por categoría: primero UBA, luego públicas, luego privadas. */
export type UniversityPin = { id: string; n: number; label: string; short: string; lat: number; lng: number; category: UniversityCategory };
/** Fila de la referencia: lleva al pin `pinId` (y comparte su número `n`). */
export type UniversityLegendItem = { label: string; pinId: string; n: number; category: UniversityCategory };

/** Orden de las categorías en la lista y en la numeración. */
export const UNIVERSITY_CATEGORY_ORDER: UniversityCategory[] = ["uba", "public", "private"];

/** Categoría de una universidad por su nombre de la lista (UBA · otras públicas · privadas; lo desconocido cuenta como privada). */
export function universityCategory(name: string): UniversityCategory {
  if (name.startsWith("UBA")) return "uba";
  return PUBLIC_NAMES.includes(name) ? "public" : "private";
}
const categoryOf = universityCategory;

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

type RawPin = Omit<UniversityPin, "n">;
type RawLegend = Omit<UniversityLegendItem, "n">;
const pins: RawPin[] = [];
const legend: RawLegend[] = [];

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
    const short = shortUniversityName(u.name);
    pins.push({ id: u.name, label: `${u.name} (${extra.main})`, short: `${short} · ${extra.main}`, lat: u.lat, lng: u.lng, category });
    legend.push({ label: `${u.name} (${extra.main})`, pinId: u.name, category });
    extra.sites.forEach((x, i) => {
      const id = `${u.name}|${i}`;
      pins.push({ id, label: `${u.name} (${x.site})`, short: `${short} · ${x.site}`, lat: x.lat, lng: x.lng, category });
      legend.push({ label: `${u.name} (${x.site})`, pinId: id, category });
    });
    continue;
  }
  pins.push({ id: u.name, label: u.name, short: shortUniversityName(u.name), lat: u.lat, lng: u.lng, category });
  legend.push({ label: u.name, pinId: u.name, category });
}

const rank = (c: UniversityCategory) => UNIVERSITY_CATEGORY_ORDER.indexOf(c);
export const UNIVERSITY_PINS: UniversityPin[] = pins
  .map((p, i) => ({ p, i }))
  .sort((a, b) => rank(a.p.category) - rank(b.p.category) || a.i - b.i)
  .map(({ p }, k) => ({ ...p, n: k + 1 }));
const numberOf = new Map(UNIVERSITY_PINS.map((p) => [p.id, p.n]));
/** Referencia ordenada por número de pin (UBA, públicas, privadas); las filas que comparten sede repiten el número. */
export const UNIVERSITY_LEGEND: UniversityLegendItem[] = legend
  .map((l, i) => ({ l, i }))
  .sort((a, b) => numberOf.get(a.l.pinId)! - numberOf.get(b.l.pinId)! || a.i - b.i)
  .map(({ l }) => ({ ...l, n: numberOf.get(l.pinId)! }));
/** Pines que se ven al abrir el mapa: solo la UBA. El resto se elige desde la lista. */
export const DEFAULT_VISIBLE_UNIVERSITY_IDS: string[] = UNIVERSITY_PINS.filter((p) => p.category === "uba").map((p) => p.id);
/** Cantidad de universidades (no de pines ni de filas). */
export const UNIVERSITY_COUNT = BUENOS_AIRES_UNIVERSITIES.length;
