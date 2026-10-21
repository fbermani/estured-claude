/**
 * Países de Latinoamérica con su bandera — fuente única para el
 * selector de nacionalidad de "Mi perfil" (Ciclo 36, pedido del dueño:
 * "no permitir escribir manualmente, por ahora incluir todos los
 * países de Latinoamérica"). También se usa para derivar
 * `student_profiles.country_flag` automáticamente al guardar, en vez
 * de dejar esa columna sin setear como quedaba con el campo libre
 * anterior (solo la sembraban los scripts de seed para residentes
 * mock).
 */
export type LatamCountry = {
  name: string;
  flag: string;
};

export const LATAM_COUNTRIES: LatamCountry[] = [
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Costa Rica", flag: "🇨🇷" },
  { name: "Cuba", flag: "🇨🇺" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "El Salvador", flag: "🇸🇻" },
  { name: "Guatemala", flag: "🇬🇹" },
  { name: "Honduras", flag: "🇭🇳" },
  { name: "México", flag: "🇲🇽" },
  { name: "Nicaragua", flag: "🇳🇮" },
  { name: "Panamá", flag: "🇵🇦" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Perú", flag: "🇵🇪" },
  { name: "República Dominicana", flag: "🇩🇴" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Venezuela", flag: "🇻🇪" },
];

export const LATAM_COUNTRY_NAMES = LATAM_COUNTRIES.map((c) => c.name);

/**
 * Resto del mundo (auditoría 2026-10-20, H21): EstuRed también recibe a
 * quienes llegan desde el exterior (la comunidad ya muestra residentes de
 * España, Italia, Francia, Alemania, EE. UU. y Reino Unido). Se listan
 * aparte para mostrar Latinoamérica primero en el selector.
 */
export const OTHER_COUNTRIES: LatamCountry[] = [
  { name: "Alemania", flag: "🇩🇪" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "Austria", flag: "🇦🇹" },
  { name: "Bélgica", flag: "🇧🇪" },
  { name: "Canadá", flag: "🇨🇦" },
  { name: "China", flag: "🇨🇳" },
  { name: "Corea del Sur", flag: "🇰🇷" },
  { name: "Dinamarca", flag: "🇩🇰" },
  { name: "España", flag: "🇪🇸" },
  { name: "Estados Unidos", flag: "🇺🇸" },
  { name: "Finlandia", flag: "🇫🇮" },
  { name: "Francia", flag: "🇫🇷" },
  { name: "Grecia", flag: "🇬🇷" },
  { name: "India", flag: "🇮🇳" },
  { name: "Irlanda", flag: "🇮🇪" },
  { name: "Israel", flag: "🇮🇱" },
  { name: "Italia", flag: "🇮🇹" },
  { name: "Japón", flag: "🇯🇵" },
  { name: "Noruega", flag: "🇳🇴" },
  { name: "Países Bajos", flag: "🇳🇱" },
  { name: "Polonia", flag: "🇵🇱" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Reino Unido", flag: "🇬🇧" },
  { name: "Rusia", flag: "🇷🇺" },
  { name: "Sudáfrica", flag: "🇿🇦" },
  { name: "Suecia", flag: "🇸🇪" },
  { name: "Suiza", flag: "🇨🇭" },
  { name: "Turquía", flag: "🇹🇷" },
  { name: "Ucrania", flag: "🇺🇦" },
];

/** Todas las nacionalidades aceptadas (whitelist del servidor). */
export const COUNTRY_NAMES = [...LATAM_COUNTRIES, ...OTHER_COUNTRIES].map((c) => c.name);

export const FLAG_BY_COUNTRY: Record<string, string> = Object.fromEntries(
  [...LATAM_COUNTRIES, ...OTHER_COUNTRIES].map((c) => [c.name, c.flag]),
);
