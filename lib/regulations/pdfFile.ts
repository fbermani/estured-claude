/**
 * Reglamento propio como archivo PDF (DR62 a). Lógica pura, sin dependencias de Node: la importan también componentes de cliente.
 * El dato del archivo vive en `content.pdf` de la versión (no en `file_id`). El `content_hash` de la versión es el SHA-256 de los bytes.
 */

/** Tope del PDF del reglamento (decisión del dueño, 2026-11-20). */
export const MAX_REGULATION_PDF_BYTES = 5 * 1024 * 1024;

export const REGULATION_PDF_BUCKET = "private-residence-documents";

/** Texto que guarda la versión PDF en `content.text`: es lo que se lee donde no se puede abrir el archivo. */
export const REGULATION_PDF_NOTICE =
  "El reglamento de esta residencia es un archivo PDF. Abrilo con el botón «Descargar reglamento (PDF)» y leelo completo antes de aceptarlo.";

export type RegulationPdfInfo = { path: string; filename: string; sizeBytes: number };

/** Lee `content.pdf` de una versión. `null` si la versión no es un PDF o el dato está mal formado. */
export function parseRegulationPdf(content: unknown): RegulationPdfInfo | null {
  if (typeof content !== "object" || content === null) return null;
  const pdf = (content as Record<string, unknown>).pdf;
  if (typeof pdf !== "object" || pdf === null) return null;
  const p = pdf as Record<string, unknown>;
  if (typeof p.path !== "string" || p.path.length === 0 || typeof p.filename !== "string") return null;
  const size = typeof p.size_bytes === "number" && Number.isFinite(p.size_bytes) ? p.size_bytes : 0;
  return { path: p.path, filename: p.filename, sizeBytes: size };
}

export function formatPdfSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
