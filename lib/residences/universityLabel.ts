/**
 * Nombre corto de una universidad o facultad para mostrar en tarjetas y en la ficha (donde falta lugar). Es solo
 * presentación: el dato guardado y los filtros siguen usando el nombre completo de `lib/data/buenosAiresUniversities.ts`.
 *
 * Reglas:
 * - Sedes de la UBA: «UBA» + la especialidad, sin «Facultad de» (`UBA - Facultad de Derecho` → `UBA Derecho`).
 * - Si el nombre trae la sigla entre paréntesis, se usa la sigla (`Universidad Católica Argentina (UCA)` → `UCA`;
 *   `... (UTN - FRBA)` → `UTN FRBA`; `UBA - Facultad de Arquitectura, ... (FADU)` → `UBA FADU`).
 * - Si no, se abrevian «Universidad», «Facultad», «Nacional», «Instituto» y «Universitario».
 */

const UBA_PREFIX = /^UBA\s*-\s*/i;
const PARENTHETICAL = /\(([^)]+)\)\s*$/;

export function abbreviateUniversity(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const acronym = PARENTHETICAL.exec(trimmed)?.[1]?.replace(/\s*-\s*/g, " ").trim();
  const isUba = UBA_PREFIX.test(trimmed);

  if (isUba) {
    if (acronym && /^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(acronym)) return `UBA ${acronym}`;
    const rest = trimmed
      .replace(UBA_PREFIX, "")
      .replace(/^Facultad\s+de(?:l|\s+la)?\s+/i, "")
      .replace(/^Ciencias\s+(Económicas|Exactas|Sociales|Veterinarias|Agrarias)\b/i, "$1")
      .trim();
    return rest ? `UBA ${rest}` : "UBA";
  }

  if (acronym && /^[A-ZÁÉÍÓÚÑ0-9 ]{2,}$/.test(acronym)) return acronym;

  return trimmed
    .replace(/^Universidad\b/i, "U.")
    .replace(/\bFacultad\b/gi, "Fac.")
    .replace(/\bNacional\b/gi, "Nac.")
    .replace(/^Instituto\b/i, "Inst.")
    .replace(/\bUniversitario\b/gi, "Univ.");
}

/** Une nombres cortos con «, » y «y» final (`UBA Derecho, UCA y UP`). */
export function joinUniversityNames(names: string[]): string {
  const short = names.map(abbreviateUniversity);
  return short.length > 1 ? `${short.slice(0, -1).join(", ")} y ${short[short.length - 1]}` : (short[0] ?? "");
}
