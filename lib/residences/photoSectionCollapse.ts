/**
 * Lógica pura del colapso de las secciones de la galería de fotos del perfil (PhotoMetaManager).
 * Las secciones siempre quedan montadas (el estado de subida y edición de cada foto no se pierde): solo se oculta el cuerpo.
 */

/** Lo que hace falta saber de una sección para resumirla y decidir si arranca abierta. */
export type SectionActivity = {
  key: string;
  /** Fotos ya guardadas en la sección. */
  photos: number;
  /** Fotos de la sección que el equipo todavía no aprobó. */
  pendingPhotos: number;
  /** Subidas en curso a esa sección. */
  uploading: number;
  /** Subidas que fallaron y siguen esperando una acción (reintentar o quitar). */
  failedUploads: number;
};

export type SectionStatusTone = "neutral" | "warning" | "danger";

export type SectionSummary = {
  /** «6 fotos», «1 foto» o «Sin fotos». */
  countLabel: string;
  /** Estado que se muestra al lado del conteo (null si no hay nada que avisar). */
  status: { label: string; tone: SectionStatusTone } | null;
};

/** «Sin fotos» / «1 foto» / «6 fotos». */
export function photoCountLabel(count: number): string {
  if (count <= 0) return "Sin fotos";
  return count === 1 ? "1 foto" : `${count} fotos`;
}

/** Conteo y estado de la cabecera. Prioridad del estado: error de subida, subida en curso, fotos en revisión. */
export function summarizeSection(section: SectionActivity): SectionSummary {
  const countLabel = photoCountLabel(section.photos + section.uploading);
  if (section.failedUploads > 0) {
    return { countLabel, status: { label: section.failedUploads === 1 ? "Una foto no se subió" : `${section.failedUploads} fotos no se subieron`, tone: "danger" } };
  }
  if (section.uploading > 0) return { countLabel, status: { label: "Subiendo…", tone: "neutral" } };
  if (section.pendingPhotos > 0) {
    return {
      countLabel,
      status: { label: section.pendingPhotos === 1 ? "1 en revisión" : `${section.pendingPhotos} en revisión`, tone: "warning" },
    };
  }
  return { countLabel, status: null };
}

/** ¿La sección pide atención ya mismo? Hoy: una subida fallida (hay que reintentar o quitar). */
export function needsAttention(section: SectionActivity): boolean {
  return section.failedUploads > 0;
}

/** Claves de las secciones que arrancan abiertas: solo las que pierden información si quedan cerradas. El resto arranca colapsada. */
export function initialOpenKeys(sections: SectionActivity[]): Set<string> {
  return new Set(sections.filter(needsAttention).map((s) => s.key));
}

/**
 * ¿Está abierta? La elección explícita de la persona manda; sin elección, vale el estado inicial.
 * `toggled` guarda solo lo que se tocó (true abierta, false cerrada).
 */
export function isSectionOpen(key: string, toggled: Record<string, boolean>, initialOpen: Set<string>): boolean {
  return toggled[key] ?? initialOpen.has(key);
}

/** Alterna una sección respetando el estado visible actual. */
export function toggleSection(key: string, toggled: Record<string, boolean>, initialOpen: Set<string>): Record<string, boolean> {
  return { ...toggled, [key]: !isSectionOpen(key, toggled, initialOpen) };
}

/** Fuerza una sección abierta (p. ej. cuando falla una subida o se suelta una foto en ella). Devuelve el mismo objeto si ya estaba abierta. */
export function openSection(key: string, toggled: Record<string, boolean>, initialOpen: Set<string>): Record<string, boolean> {
  return isSectionOpen(key, toggled, initialOpen) ? toggled : { ...toggled, [key]: true };
}
