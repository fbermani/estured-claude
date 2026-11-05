/**
 * Detecta el tipo REAL de un archivo subido por sus primeros bytes (firma), sin confiar en el MIME ni en la extensión que declara el
 * cliente. Un HTML, un SVG o un ejecutable con `Content-Type: application/pdf` da `null`.
 *
 * Comprobantes y documentos aceptan PDF + JPEG/PNG/WebP (`resolveDocumentType`); la evidencia de soporte suma video y audio
 * (`resolveEvidenceType`). La galería de residencias usa su propio helper de solo imágenes (`lib/residences/imageSniff.ts`).
 */
import { sniffImageType } from "@/lib/residences/imageSniff";

export type DocumentMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export type EvidenceMime = DocumentMime | "video/mp4" | "video/quicktime" | "audio/mpeg" | "audio/mp4" | "audio/ogg";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);
}

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

/** Tipo real según la firma, o `null` si no es ninguno de los formatos admitidos. Alcanza con los primeros 16 bytes. */
export function sniffFileType(bytes: Uint8Array): EvidenceMime | null {
  const image = sniffImageType(bytes);
  if (image) return image;
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  // MP4 / QuickTime / M4A: caja "ftyp" en el byte 4; la marca mayor (byte 8) distingue QuickTime.
  if (startsWith(bytes, ascii("ftyp"), 4)) return startsWith(bytes, ascii("qt  "), 8) ? "video/quicktime" : "video/mp4";
  if (startsWith(bytes, ascii("OggS"))) return "audio/ogg";
  // MP3: etiqueta ID3 o sincronismo de cuadro MPEG (11 bits en 1).
  if (startsWith(bytes, ascii("ID3")) || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

async function readHead(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 16).arrayBuffer());
}

/** Tipo real para comprobantes/documentos (PDF o imagen), o `null` si el contenido no coincide con ninguno. */
export async function resolveDocumentType(file: Blob): Promise<DocumentMime | null> {
  const real = sniffFileType(await readHead(file));
  return real === "application/pdf" || real === "image/jpeg" || real === "image/png" || real === "image/webp" ? real : null;
}

/** Tipo real para evidencia de soporte. Un `.m4a` declarado como `audio/mp4` conserva ese tipo (comparte firma con el MP4). */
export async function resolveEvidenceType(file: Blob, declaredType: string): Promise<EvidenceMime | null> {
  const real = sniffFileType(await readHead(file));
  if (real === "video/mp4" && declaredType === "audio/mp4") return "audio/mp4";
  return real;
}

const EXTENSIONS: Record<EvidenceMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

/** Extensión segura derivada del tipo REAL (nunca del nombre que mandó el cliente). */
export function extensionForMime(type: EvidenceMime): string {
  return EXTENSIONS[type];
}
