/**
 * Versiones de los textos legales publicados (LEG-012). Módulo puro: lo usan páginas, pie y acciones del servidor.
 * Al cambiar un texto: actualizá su `version` (fecha ISO del cambio) y su `updatedLabel`. El hash del texto se calcula en
 * `lib/legal/consentVersion.ts` (solo servidor) y se guarda junto con la versión en cada consentimiento.
 */
export const LEGAL_DOCUMENTS = {
  terms: { version: "2026-11-25", updatedLabel: "25 de noviembre de 2026", title: "Términos y condiciones" },
  privacy: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Política de privacidad" },
  residence_terms: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Condiciones para residencias" },
  /** Casilla del fee (`lib/legal/clauses.ts`). */
  estured_fee_terms: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Política del fee" },
  /** Casilla de responsabilidad de la residencia (`lib/legal/clauses.ts`). */
  residence_responsibility: { version: "2026-11-22", updatedLabel: "22 de noviembre de 2026", title: "Responsabilidad de la residencia" },
} as const;

/**
 * Versión de los consentimientos que no tienen un texto propio en este módulo (casillas que viven en su formulario, como
 * `student_visibility` o `residence_payment_received`). Reemplaza al viejo «v0.1-borrador». Pendiente: mover esos textos acá para
 * versionarlos con hash.
 */
export const DATED_CONSENT_VERSION = "2026-11-22";

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/** Fecha más reciente entre los textos publicados (la que muestra el pie). Se deriva: no puede quedar desfasada. */
export const LEGAL_TEXTS_UPDATED_LABEL: string = Object.values(LEGAL_DOCUMENTS).reduce((newest, doc) =>
  doc.version > newest.version ? doc : newest,
).updatedLabel;
