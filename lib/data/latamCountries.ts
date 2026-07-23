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

export const FLAG_BY_COUNTRY: Record<string, string> = Object.fromEntries(
  LATAM_COUNTRIES.map((c) => [c.name, c.flag]),
);
