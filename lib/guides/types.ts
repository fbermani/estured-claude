/**
 * Modelo del Centro de Guías (DR28). Orientado a la spec §9 pero sin migración:
 * el contenido vive en `content/guias/*.md` y se parsea a este shape.
 * Pensado para crecer (checklists, calculadora) sin romper guías existentes:
 * las secciones son listas de bloques tipados y `embed` queda reservado.
 */

export const GUIDE_CATEGORIES = ["alojamiento", "mudanza", "convivencia", "familias", "gestion-residencias"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export const GUIDE_AUDIENCES = ["estudiantes", "familias", "residencias"] as const;
export type GuideAudience = (typeof GUIDE_AUDIENCES)[number];

/** Etapa del recorrido para «Empezá por acá». */
export const GUIDE_STAGES = ["buscando", "por-viajar", "alojado", "familias", "residencias"] as const;
export type GuideStage = (typeof GUIDE_STAGES)[number];

export type GuideStatus = "borrador-editorial" | "published" | "draft" | "archived";

export type GuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  /** Preguntas de un «Checklist»: se muestran con casillas visuales, el texto no cambia. */
  | { type: "checklist"; items: string[] }
  /** Tabla Markdown simple (`| a | b |`): primera fila = encabezado. */
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "subheading"; id: string; text: string }
  /** Reservado para herramientas futuras (checklist guardable, calculadora). Hoy no se renderiza. */
  | { type: "embed"; name: string };

export type GuideSectionVariant = "default" | "checklist" | "next-step" | "idea" | "family";

export interface GuideSection {
  id: string;
  heading: string;
  variant: GuideSectionVariant;
  blocks: GuideBlock[];
}

export interface GuideCta {
  label: string;
  href: string;
}

export interface Guide {
  /** Prefijo de archivo (ej. `02-guia-mudarte-buenos-aires`); lo usan `related_guides`. */
  id: string;
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
  audience: GuideAudience[];
  status: GuideStatus;
  order: number;
  featured: boolean;
  stage?: GuideStage;
  tags: string[];
  /** Línea en mayúsculas bajo el H1 (ej. «ESTUDIANTES Y FAMILIAS»). */
  eyebrow?: string;
  /** Primer párrafo antes del primer H2. */
  lede?: string;
  sections: GuideSection[];
  /** Párrafo final «Para seguir explorando…», fuera de los recuadros. */
  closingNote?: string;
  wordCount: number;
  readMinutes: number;
  relatedGuideIds: string[];
  cta?: GuideCta;
  heroImage?: { src: string; alt: string };
  /** Solo si hay una fecha verificada: si falta, no se muestra «revisado el…» ni `datePublished`. */
  updatedAt?: string;
  reviewedAt?: string;
  author?: string;
  seo: { title: string; description: string; canonical?: string };
}

/** Lo mínimo que necesita una tarjeta (serializable, apto para pasar a un Client Component). */
export interface GuideSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
  audience: GuideAudience[];
  featured: boolean;
  readMinutes: number;
  heroImage?: { src: string; alt: string };
}
