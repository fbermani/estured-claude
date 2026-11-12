/**
 * Destino post-login seguro: solo rutas internas del mismo origen. Rechaza `//host`, `/\host`, backslashes, caracteres de control y
 * esquemas; devuelve el path+query normalizado o `null`.
 */
export function safeInternalPath(next: unknown, origin = "http://internal.invalid"): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 2000) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== new URL(origin).origin) return null;
    const normalized = `${url.pathname}${url.search}${url.hash}`;
    // El normalizado (p. ej. `/.//evil.com` -> `//evil.com`) también debe ser un path interno.
    if (normalized.startsWith("//") || normalized.startsWith("/\\") || !/^\/(?!\/)[^\\]*$/.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}
