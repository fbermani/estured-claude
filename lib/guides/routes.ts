/** Rutas internas válidas para el CTA contextual de una guía (DR28: nada de enlaces rotos). */
const STATIC_ROUTES = ["/search", "/for-residences", "/for-students", "/register", "/login", "/guias"];

export function isValidGuideCtaHref(href: string, guideSlugs: ReadonlySet<string>): boolean {
  if (STATIC_ROUTES.includes(href)) return true;
  const m = /^\/guias\/([a-z0-9-]+)$/.exec(href);
  return !!m && guideSlugs.has(m[1]);
}
