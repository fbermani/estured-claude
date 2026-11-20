/**
 * Nombre de archivo seguro para persistir en `files.filename` (CHECK ≤ 255):
 * quita caracteres de control y separadores de ruta (`/`, `\`), y recorta a
 * 255 preservando la extensión. Nunca devuelve vacío.
 */
export function safeFilename(name: string | null | undefined): string {
  const cleaned = String(name ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/[/\\]/g, "").trim();
  const base = cleaned || "archivo";
  if (base.length <= 255) return base;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 && base.length - dot <= 16 ? base.slice(dot) : "";
  return base.slice(0, 255 - ext.length) + ext;
}
