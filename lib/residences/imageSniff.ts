/**
 * Detecta el tipo REAL de una imagen por sus primeros bytes (firma del archivo), sin confiar en el MIME ni en la extensión que declara el
 * cliente. Solo JPEG, PNG y WebP (los formatos permitidos de la galería): un HTML, un SVG o un ejecutable con `Content-Type: image/png` da `null`.
 */

export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);
}

/** `null` si no es JPEG/PNG/WebP. Alcanza con los primeros 12 bytes. */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  // WebP: "RIFF" + tamaño (4 bytes) + "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function imageExtension(type: SniffedImageType): "jpg" | "png" | "webp" {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}
