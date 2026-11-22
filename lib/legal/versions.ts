/**
 * Versiones de los textos legales publicados (LEG-012). Módulo puro: lo usan páginas, pie y acciones del servidor.
 * Al cambiar un texto: actualizá su `version` (fecha ISO del cambio) y su `updatedLabel`. El hash del texto se calcula en
 * `lib/legal/consentVersion.ts` (solo servidor) y se guarda junto con la versión en cada consentimiento.
 */
export const LEGAL_DOCUMENTS = {
  terms: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Términos y condiciones" },
  privacy: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Política de privacidad" },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/** Fecha más reciente entre los textos publicados (la que muestra el pie). */
export const LEGAL_TEXTS_UPDATED_LABEL = "22 de noviembre de 2026";
