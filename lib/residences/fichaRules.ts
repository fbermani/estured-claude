/**
 * Reglas de casa principales de la ficha (capítulo «Reglas de casa»). Lógica pura.
 *
 * La residencia carga un resumen de convivencia en `residence_profile_sections.rules.summary`, una regla por línea (el campo
 * `highlightedRules` de `types/domain.ts` solo existe en el modelo del catálogo y hoy viaja vacío: la fuente real es este resumen).
 * Se muestran hasta `RULES_VISIBLE` a la vista y el resto queda en un desplegable: ninguna regla se pierde.
 */
export const RULES_VISIBLE = 5;

/** Una regla por línea; saca viñetas («-», «•», «*») y numeración («1.», «2)») que la residencia pudo haber tipeado. */
export function parseRuleLines(summary: string | null | undefined): string[] {
  return (summary ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-•*·–—]+|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** Parte las reglas en las que van a la vista y las que quedan en el desplegable (el orden se conserva). */
export function splitRules(rules: string[], visible: number = RULES_VISIBLE): { primary: string[]; more: string[] } {
  const limit = Math.max(0, Math.floor(visible));
  return { primary: rules.slice(0, limit), more: rules.slice(limit) };
}

/** Texto del desplegable: «Ver 1 regla más» / «Ver 3 reglas más». */
export function moreRulesLabel(count: number): string {
  return `Ver ${count} ${count === 1 ? "regla más" : "reglas más"}`;
}

/**
 * ¿Se ofrece «Descargar el reglamento»? Solo si la residencia cargó el suyo: un reglamento propio o adaptado del modelo (no el
 * modelo base que rige mientras no publicó nada), o un PDF subido. Con el modelo base se puede leer, pero no se ofrece como descarga.
 */
export function canDownloadRegulation(params: { regulation: { isBaseModel: boolean } | null; hasUploadedPdf: boolean }): boolean {
  return params.hasUploadedPdf || (params.regulation != null && !params.regulation.isBaseModel);
}
