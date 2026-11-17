/**
 * Listas cerradas del paso 2 de la preapertura (DR43.3, mockup v4). Módulo puro: lo usan el formulario (cliente) y la validación
 * de servidor, que rechaza cualquier valor que no esté acá. Los hábitos usan nombres neutros (CAMBIOS_SUGERIDOS #6): se muestran
 * en una tarjeta pública, así que no hay masculinos genéricos. No reemplazan los vocabularios de `lib/students/profileOptions.ts`.
 */

export const HABIT_OPTIONS = [
  "Madrugo",
  "Me acuesto tarde",
  "Orden ante todo",
  "Muy sociable",
  "Prefiero la calma",
  "Me gusta cocinar",
  "Estudio en silencio",
  "Música para estudiar",
  "No fumo",
  "Hago deporte",
  "Trabajo y estudio",
] as const;

export const INTEREST_OPTIONS = [
  "Deportes",
  "Música",
  "Cine",
  "Series",
  "Lectura",
  "Tecnología",
  "Gaming",
  "Viajes",
  "Idiomas",
  "Cocina",
  "Fotografía",
  "Arte",
  "Naturaleza",
  "Emprendimiento",
] as const;

/** Máximo de hábitos e intereses (DR43.3): 2 y 2. */
export const MAX_CHIPS = 2;

/** País y bandera para el avatar (misma idea que `country_flag` de `student_profiles`). «Otro país» no lleva bandera. */
export const COUNTRY_OPTIONS = [
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "México", flag: "🇲🇽" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Perú", flag: "🇵🇪" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Venezuela", flag: "🇻🇪" },
  { name: "Otro país", flag: "" },
] as const;

export const ARGENTINA = "Argentina";

export const PROVINCE_OPTIONS = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

/** Sugerencias (datalist) de universidad: es texto libre acotado, sin zona (DR43.3). */
export const UNIVERSITY_SUGGESTIONS = [
  "UBA",
  "UTN",
  "UADE",
  "UCA",
  "Universidad Di Tella",
  "Universidad de Belgrano",
  "Universidad Austral",
  "Universidad de Palermo",
  "UNA",
  "UNDEF",
  "UNIPE",
  "UNTREF",
  "UNSAM",
  "UniCABA",
  "ITBA",
  "USAL",
  "UCES",
  "UAI",
  "Universidad de San Andrés",
  "UCEMA",
  "Universidad Favaloro",
  "Universidad Maimónides",
  "UFLO",
  "Universidad Kennedy",
] as const;

export const CAREER_OPTIONS = [
  "Medicina",
  "Derecho",
  "Arquitectura",
  "Psicología",
  "Economía",
  "Ingeniería en Sistemas",
  "Diseño Gráfico",
] as const;

/** Valor del select de carrera que habilita el campo de texto «¿Cuál?». */
export const OTHER_CAREER = "__otra__";

/** Mes de ingreso: solo enero a abril o «Todavía no sé» (DR43.3). El año se asume (próxima temporada) en el servidor. */
export const ENTRY_MONTH_OPTIONS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "unsure", label: "Todavía no sé" },
] as const;

export const ROOM_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "shared", label: "Compartida" },
  { value: "any", label: "Me da igual" },
] as const;

export type RoomType = (typeof ROOM_TYPE_OPTIONS)[number]["value"];

export function flagFor(country: string | null | undefined): string {
  return COUNTRY_OPTIONS.find((c) => c.name === country)?.flag ?? "";
}
