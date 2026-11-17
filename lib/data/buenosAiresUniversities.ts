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
  { name: "UBA - Facultad de Derecho", lat: -34.5811, lng: -58.3919 },
  { name: "UBA - Facultad de Medicina", lat: -34.5998, lng: -58.3958 },
  { name: "UBA - Facultad de Ingeniería", lat: -34.628, lng: -58.3697 },
  { name: "UBA - Facultad de Ciencias Económicas", lat: -34.5987, lng: -58.3931 },
  { name: "UBA - Facultad de Filosofía y Letras", lat: -34.6198, lng: -58.4359 },
  { name: "UBA - Ciudad Universitaria", lat: -34.5445, lng: -58.4438 },
  { name: "UBA - Facultad de Arquitectura, Diseño y Urbanismo (FADU)", lat: -34.5442, lng: -58.4437 },
  { name: "UBA - Facultad de Psicología", lat: -34.6196, lng: -58.4087 },
  { name: "UBA - Facultad de Ciencias Sociales", lat: -34.6225, lng: -58.3843 },
  { name: "UBA - Facultad de Odontología", lat: -34.5951, lng: -58.3953 },
  { name: "Universidad Católica Argentina (UCA)", lat: -34.6086, lng: -58.3653 },
  { name: "Universidad de Palermo (UP)", lat: -34.5978, lng: -58.4131 },
  { name: "UADE", lat: -34.6135, lng: -58.382 },
  { name: "Instituto Tecnológico de Buenos Aires (ITBA)", lat: -34.6002, lng: -58.3701 },
  { name: "Universidad de Belgrano", lat: -34.5629, lng: -58.4562 },
  { name: "Universidad Torcuato Di Tella (UTDT)", lat: -34.5445, lng: -58.447 },
  { name: "Universidad del Salvador (USAL)", lat: -34.6034, lng: -58.3812 },
  { name: "Universidad Tecnológica Nacional (UTN - FRBA)", lat: -34.5975, lng: -58.4171 },
  { name: "Universidad de Ciencias Empresariales y Sociales (UCES)", lat: -34.5934, lng: -58.3819 },
  { name: "Universidad Abierta Interamericana (UAI)", lat: -34.5817, lng: -58.4487 },
  { name: "Universidad Nacional de las Artes (UNA)", lat: -34.5966, lng: -58.3937 },
  { name: "Instituto Universitario del Hospital Italiano", lat: -34.6055, lng: -58.4172 },
  { name: "Universidad Argentina John F. Kennedy (UK)", lat: -34.6157, lng: -58.3811 },
];

export const UNIVERSITY_NAMES = BUENOS_AIRES_UNIVERSITIES.map((u) => u.name);

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
