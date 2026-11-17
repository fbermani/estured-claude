/**
 * Universidades de CABA con coordenadas aproximadas de su sede/campus
 * principal — dato geográfico real (ubicaciones públicas conocidas), no
 * inventado. Fuente única para: (1) el whitelist de "universidades
 * cercanas" que carga el dueño de residencia (`lib/residences/options.ts`
 * deriva `UNIVERSITY_OPTIONS` de acá), (2) el filtro de universidad en
 * `/search`, y (3) el mapa compacto de la ficha de residencia. Ampliar
 * esta lista es la única forma de agregar universidades en los tres
 * lugares a la vez, sin duplicar datos.
 */
export type BuenosAiresUniversity = {
  name: string;
  lat: number;
  lng: number;
};

export const BUENOS_AIRES_UNIVERSITIES: BuenosAiresUniversity[] = [
  // UBA (las 13 facultades, la Ciudad Universitaria y las sedes del CBC)
  { name: "UBA - Facultad de Derecho", lat: -34.5826, lng: -58.3921 },
  { name: "UBA - Facultad de Medicina", lat: -34.5981, lng: -58.3985 },
  { name: "UBA - Facultad de Ingeniería", lat: -34.6177, lng: -58.3683 },
  { name: "UBA - Facultad de Ciencias Económicas", lat: -34.5997, lng: -58.3982 },
  { name: "UBA - Facultad de Filosofía y Letras", lat: -34.6268, lng: -58.4437 },
  { name: "UBA - Ciudad Universitaria", lat: -34.5445, lng: -58.4438 },
  { name: "UBA - Facultad de Arquitectura, Diseño y Urbanismo (FADU)", lat: -34.5446, lng: -58.4426 },
  { name: "UBA - Facultad de Ciencias Exactas y Naturales", lat: -34.5425, lng: -58.4414 },
  { name: "UBA - Facultad de Psicología", lat: -34.6186, lng: -58.4093 },
  { name: "UBA - Facultad de Ciencias Sociales", lat: -34.6203, lng: -58.3849 },
  { name: "UBA - Facultad de Odontología", lat: -34.5973, lng: -58.3982 },
  { name: "UBA - Facultad de Farmacia y Bioquímica", lat: -34.5975, lng: -58.3986 },
  { name: "UBA - Facultad de Agronomía", lat: -34.5934, lng: -58.4812 },
  { name: "UBA - Facultad de Ciencias Veterinarias", lat: -34.5956, lng: -58.4777 },
  { name: "UBA - CBC Sede Ramos Mejía", lat: -34.6056, lng: -58.4319 },
  { name: "UBA - CBC Sede Drago", lat: -34.5678, lng: -58.4787 },
  { name: "UBA - CBC Sede Montes de Oca", lat: -34.6392, lng: -58.3743 },
  // Otras universidades e institutos universitarios públicos
  { name: "Universidad Tecnológica Nacional (UTN - FRBA)", lat: -34.5986, lng: -58.4201 },
  { name: "Universidad Nacional de las Artes (UNA)", lat: -34.5947, lng: -58.4017 },
  { name: "Universidad de la Defensa Nacional (UNDEF)", lat: -34.6052, lng: -58.3768 },
  { name: "Universidad Pedagógica Nacional (UNIPE)", lat: -34.6208, lng: -58.3763 },
  { name: "Universidad Nacional de Tres de Febrero (UNTREF)", lat: -34.5936, lng: -58.3863 },
  { name: "Universidad Nacional de San Martín (UNSAM)", lat: -34.6054, lng: -58.3782 },
  { name: "Universidad de la Ciudad de Buenos Aires (UniCABA)", lat: -34.6105, lng: -58.3698 },
  { name: "Instituto Universitario de la Policía Federal (IUPFA)", lat: -34.6184, lng: -58.4357 },
  { name: "Instituto Universitario de Gendarmería Nacional (IUGNA)", lat: -34.6138, lng: -58.3691 },
  { name: "Instituto Universitario de Seguridad (IUSE)", lat: -34.6368, lng: -58.4521 },
  { name: "Instituto Universitario Nacional de Derechos Humanos (IUNMa)", lat: -34.6095, lng: -58.3718 },
  // Universidades e institutos privados
  { name: "Universidad Católica Argentina (UCA)", lat: -34.6086, lng: -58.3653 },
  { name: "Universidad de Palermo (UP)", lat: -34.5978, lng: -58.4131 },
  { name: "UADE", lat: -34.6135, lng: -58.382 },
  { name: "Instituto Tecnológico de Buenos Aires (ITBA)", lat: -34.6002, lng: -58.3701 },
  { name: "Universidad de Belgrano", lat: -34.5629, lng: -58.4562 },
  { name: "Universidad Torcuato Di Tella (UTDT)", lat: -34.5445, lng: -58.447 },
  { name: "Universidad del Salvador (USAL)", lat: -34.6034, lng: -58.3812 },
  { name: "Universidad de Ciencias Empresariales y Sociales (UCES)", lat: -34.5934, lng: -58.3819 },
  { name: "Universidad Abierta Interamericana (UAI)", lat: -34.5817, lng: -58.4487 },
  { name: "Instituto Universitario del Hospital Italiano", lat: -34.6055, lng: -58.4172 },
  { name: "Universidad Argentina John F. Kennedy (UK)", lat: -34.6157, lng: -58.3811 },
  { name: "Universidad de San Andrés (UdeSA)", lat: -34.5939, lng: -58.3945 },
  { name: "Universidad del CEMA (UCEMA)", lat: -34.5987, lng: -58.3724 },
  { name: "Universidad Favaloro", lat: -34.6141, lng: -58.3905 },
  { name: "Fundación Barceló", lat: -34.5905, lng: -58.3929 },
  { name: "Universidad Maimónides", lat: -34.6104, lng: -58.4409 },
  { name: "Universidad de Flores (UFLO)", lat: -34.6326, lng: -58.4631 },
  { name: "Universidad del Museo Social Argentino (UMSA)", lat: -34.6053, lng: -58.3889 },
  { name: "Universidad CAECE", lat: -34.609, lng: -58.3787 },
  { name: "Universidad de la Marina Mercante (UdeMM)", lat: -34.6099, lng: -58.3983 },
  { name: "Universidad del Cine (UCINE)", lat: -34.6179, lng: -58.3707 },
  { name: "Universidad ISALUD", lat: -34.6138, lng: -58.3783 },
  { name: "ESEADE", lat: -34.5807, lng: -58.4232 },
  { name: "FLACSO Argentina", lat: -34.6023, lng: -58.3953 },
  { name: "TEA y Deportea", lat: -34.6033, lng: -58.3965 },
  { name: "ETER (Escuela Terciaria de Estudios Radiofónicos)", lat: -34.5968, lng: -58.4422 },
  { name: "IAG (Instituto Argentino de Gastronomía)", lat: -34.5956, lng: -58.3894 },
];

/**
 * Instituciones de CABA sin coordenadas confiables todavía: se pueden elegir en los listados, pero no se dibujan en el
 * mapa ni entran en el cálculo de distancia (igual que cualquier nombre sin coordenada, ver `findUniversitiesByName`).
 * Al tener una dirección verificada se pasan a `BUENOS_AIRES_UNIVERSITIES`.
 */
export const UNLOCATED_UNIVERSITY_NAMES: string[] = [
  "Universidad Austral",
  "Universidad Metropolitana para la Educación y el Trabajo (UMET)",
  "Instituto Universitario CEMIC",
  "Escuela Argentina de Negocios (IUEAN)",
  "Universidad Siglo 21",
];

/** Opción «Otra» del listado de proximidad de las residencias (no tiene coordenadas ni se muestra al público). */
export const UNIVERSITY_OTHER_NAME = "Otra universidad o instituto";

/** Nombres sin la opción «Otra» (para mostrar al público). */
export function withoutOtherUniversity(names: string[]): string[] {
  return names.filter((n) => n !== UNIVERSITY_OTHER_NAME);
}

export const UNIVERSITY_NAMES = [...BUENOS_AIRES_UNIVERSITIES.map((u) => u.name), ...UNLOCATED_UNIVERSITY_NAMES];

/** Distancia aproximada en km entre dos coordenadas (fórmula de Haversine). */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export function findUniversitiesByName(names: string[]): BuenosAiresUniversity[] {
  const set = new Set(names);
  return BUENOS_AIRES_UNIVERSITIES.filter((u) => set.has(u.name));
}
