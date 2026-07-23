/**
 * Vocabulario fijo de "Intereses" y "Hábitos" del perfil de estudiante
 * (Ciclo 36) — mismo patrón que `lib/residences/options.ts`
 * (SERVICE_OPTIONS/COMMON_AREA_OPTIONS): un whitelist cerrado que el
 * formulario pisa por chip seleccionable, no texto libre. Estos son
 * los mismos campos que ya lee `lib/residents/communityVisibility.ts`
 * para armar el perfil público de comunidad — completar acá alimenta
 * directamente esa vista.
 */
export const INTEREST_OPTIONS = [
  "Deportes",
  "Música",
  "Cine",
  "Series",
  "Lectura",
  "Tecnología",
  "Programación",
  "Gaming",
  "Viajes",
  "Idiomas",
  "Cocina",
  "Fotografía",
  "Arte",
  "Naturaleza",
  "Emprendimiento",
  "Voluntariado",
] as const;

export const HABIT_OPTIONS = [
  "Madrugador",
  "Nocturno",
  "Ordenado",
  "Muy sociable",
  "Tranquilo",
  "Me gusta cocinar",
  "Estudio en silencio",
  "Escucho música para estudiar",
  "No fumo",
  "Fumador",
  "Hago deporte",
  "Trabajo mientras estudio",
  "Recibo visitas ocasionalmente",
] as const;

/** Valor sentinela del <select> de universidad — nunca se guarda tal cual, dispara el campo de texto libre. */
export const UNIVERSITY_OTHER_VALUE = "__otra__";

export const BIO_MAX_LENGTH = 500;
