/** Tono por rol de la zona logueada (kit 2026-10-30). El rol define el tono; nadie elige colores a mano. */
export type RoleTone = "student" | "family" | "residence" | "admin";

/** Clase utilitaria de `app/globals.css` que setea las variables `--tone*`. */
export function toneClass(tone?: RoleTone): string {
  return tone ? `tone-${tone}` : "";
}
