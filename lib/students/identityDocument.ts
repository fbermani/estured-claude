/**
 * DR58 — documento de identidad del estudiante. Helper PURO (sin base de datos).
 * Se guarda normalizado: mayúsculas, sin espacios, puntos ni guiones.
 */
export const IDENTITY_DOCUMENT_TYPES = ["dni", "passport", "other"] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export const IDENTITY_DOCUMENT_TYPE_LABELS: Record<IdentityDocumentType, string> = {
  dni: "DNI",
  passport: "Pasaporte",
  other: "Otro documento",
};

export function isIdentityDocumentType(value: unknown): value is IdentityDocumentType {
  return typeof value === "string" && (IDENTITY_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function normalizeIdentityDocumentNumber(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\s.\-]/g, "")
    .toUpperCase();
}

export type IdentityDocumentResult =
  | { ok: true; type: IdentityDocumentType; number: string }
  | { ok: false; message: string };

export function validateIdentityDocument(rawType: unknown, rawNumber: unknown): IdentityDocumentResult {
  if (!isIdentityDocumentType(rawType)) return { ok: false, message: "Elegí el tipo de documento." };
  const number = normalizeIdentityDocumentNumber(rawNumber);
  if (!number) return { ok: false, message: "Escribí el número de documento." };
  if (rawType === "dni") {
    if (!/^\d{7,8}$/.test(number)) return { ok: false, message: "El DNI tiene 7 u 8 números." };
  } else if (!/^[A-Z0-9]{5,20}$/.test(number)) {
    return { ok: false, message: "El número debe tener entre 5 y 20 letras o números, sin símbolos." };
  }
  return { ok: true, type: rawType, number };
}

/** Para mostrar al propio estudiante sin dejar el número completo en pantalla: «••••567». */
export function maskIdentityDocumentNumber(number: string): string {
  if (number.length <= 3) return "•".repeat(number.length);
  return "•".repeat(number.length - 3) + number.slice(-3);
}
