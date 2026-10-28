/** Normalización de los datos de un residente cargado sin mail (DR18 t4). Pura, sin I/O. */

/** Nombre y apellido: espacios colapsados, 2 a 80 caracteres. `null` si falta o es inválido. */
export function normalizeResidentName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim();
  return v.length >= 2 && v.length <= 80 ? v : null;
}

/** Teléfono: solo dígitos (se aceptan +, espacios y guiones al tipearlo), 8 a 15 dígitos con código de país. `null` si falta o es inválido. */
export function normalizeResidentPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s()+-]/g, "");
  return /^[0-9]{8,15}$/.test(digits) ? digits : null;
}
