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

/**
 * Carreras más frecuentes entre estudiantes de la plataforma — mismo
 * vocabulario EXACTO que `CAREERS` en `scripts/seed-residence-community.mjs`
 * (duplicado a propósito, ver la lección de Ciclo 36 sobre por qué
 * tienen que coincidir letra por letra). "Otra carrera…" dispara el
 * campo de texto libre, mismo patrón que la universidad.
 */
export const CAREER_OPTIONS = [
  "Medicina",
  "Derecho",
  "Ingeniería Industrial",
  "Arquitectura",
  "Psicología",
  "Ciencias Políticas",
  "Economía",
  "Diseño Gráfico",
  "Relaciones Internacionales",
  "Contador Público",
  "Comunicación Social",
  "Ingeniería en Sistemas",
  "Odontología",
  "Veterinaria",
  "Administración de Empresas",
  "Biología",
  "Letras",
  "Nutrición",
  "Kinesiología",
  "Ciencias de la Educación",
] as const;

/** Valores sentinela de los <select> de universidad/carrera — nunca se guardan tal cual, disparan el campo de texto libre. */
export const UNIVERSITY_OTHER_VALUE = "__otra__";
export const CAREER_OTHER_VALUE = "__otra__";

/** Corto a propósito: este texto se muestra completo en la card flotante de Comunidad (sin truncar), 500 caracteres ahí es demasiado. */
export const BIO_MAX_LENGTH = 240;
