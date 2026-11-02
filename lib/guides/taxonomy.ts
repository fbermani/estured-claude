import type { GuideAudience, GuideCategory, GuideStage } from "./types";

/** Etiquetas, íconos (Material Symbols) y colores por categoría. Seguro para cliente (sin fs). */
export const CATEGORY_META: Record<
  GuideCategory,
  { label: string; icon: string; blurb: string; tile: string; gradient: string }
> = {
  alojamiento: {
    label: "Alojamiento",
    icon: "bed",
    blurb: "Cómo comparar y elegir dónde vivir.",
    tile: "bg-forest-tint text-forest-700",
    gradient: "from-forest-tint via-mint to-cream text-forest-700",
  },
  mudanza: {
    label: "Mudanza a Buenos Aires",
    icon: "luggage",
    blurb: "Trámites, transporte y primeros días.",
    tile: "bg-sky text-sky-fg",
    gradient: "from-sky via-blue-tint to-cream text-sky-fg",
  },
  convivencia: {
    label: "Convivencia y estudio",
    icon: "diversity_3",
    blurb: "Rutinas, acuerdos y bienestar.",
    tile: "bg-lilac text-lilac-fg",
    gradient: "from-lilac via-cream-2 to-cream text-lilac-fg",
  },
  familias: {
    label: "Para familias",
    icon: "family_restroom",
    blurb: "Acompañar sin reemplazar decisiones.",
    tile: "bg-orange-tint text-orange-700",
    gradient: "from-peach via-orange-tint to-cream text-orange-700",
  },
  "gestion-residencias": {
    label: "Para residencias",
    icon: "domain",
    blurb: "Recursos para equipos y administradores.",
    tile: "bg-butter text-butter-fg",
    gradient: "from-butter via-amber-soft-100 to-cream text-butter-fg",
  },
};

export const AUDIENCE_META: Record<GuideAudience, { label: string }> = {
  estudiantes: { label: "Estudiantes" },
  familias: { label: "Familias" },
  residencias: { label: "Residencias" },
};

export const STAGE_META: Record<GuideStage, { label: string; hint: string; icon: string }> = {
  buscando: { label: "Estoy buscando residencia", hint: "Qué revisar antes de decidir.", icon: "search" },
  "por-viajar": { label: "Estoy por viajar", hint: "Preparar la mudanza y evitar imprevistos.", icon: "flight_takeoff" },
  alojado: { label: "Ya vivo en una residencia", hint: "Organizarte y convivir mejor.", icon: "home" },
  familias: { label: "Soy familiar", hint: "Elegir y acompañar la nueva etapa.", icon: "family_restroom" },
  residencias: { label: "Gestiono una residencia", hint: "Recursos para tu equipo.", icon: "domain" },
};

/** Etapa por defecto cuando el frontmatter no trae `stage` (id = prefijo de archivo). */
export const DEFAULT_STAGE_BY_ID: Record<string, GuideStage> = {
  "01-como-elegir-residencia-estudiantil": "buscando",
  "02-guia-mudarte-buenos-aires": "por-viajar",
  "03-errores-comunes-mudanza": "por-viajar",
  "04-estudiar-y-convivir": "alojado",
  "05-guia-para-familias": "familias",
  "R01-guia-operadores-residencias": "residencias",
};
