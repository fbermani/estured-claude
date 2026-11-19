/**
 * Decide si un enlace saca a la persona de la pantalla actual (y por lo tanto hay que avisar de los cambios sin guardar).
 * Devuelve la ruta destino (`/ruta?consulta#ancla`) si es una navegación interna a otra página; null si es un enlace externo, un
 * ancla de la misma página (como el índice de secciones) o una URL que no se puede leer.
 */
export function leavingNavigationTarget(href: string, currentHref: string): string | null {
  let target: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    target = new URL(href, current);
  } catch {
    return null;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;
  if (target.origin !== current.origin) return null;
  if (target.pathname === current.pathname && target.search === current.search) return null;
  return target.pathname + target.search + target.hash;
}
