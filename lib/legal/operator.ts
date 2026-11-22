/**
 * Titular de EstuRed (LEG-001). Decisión del dueño (2026-11-22): estos datos se publican SOLO en `/terms`, sección «Quiénes somos»
 * (`#quienes-somos`). El pie del sitio, `/privacy` y los comprobantes remiten a esa sección; no repiten nombre ni CUIT.
 * No copiar estos datos a docs, MEMORY.md ni mensajes de commit.
 */
export const LEGAL_OPERATOR = {
  fullName: "Fabricio Bermani",
  cuit: "20-30450091-4",
  /** Domicilio publicado (decisión del dueño: sin calle ni número; riesgo aceptado, ver auditoría legal LEG-001). */
  domicile: "Ciudad Autónoma de Buenos Aires, Argentina",
  contactEmail: "hola@estured.com",
  privacyEmail: "hola@estured.com",
  tradeName: "EstuRed",
} as const;

/** Enlace a los datos del titular. */
export const OPERATOR_SECTION_HREF = "/terms#quienes-somos";
