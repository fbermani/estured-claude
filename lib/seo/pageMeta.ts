import type { Metadata } from "next";

/**
 * Metadata SEO común de una página pública: canonical, Open Graph y Twitter.
 * Las URLs son relativas a propósito: `metadataBase` (app/layout.tsx, = SITE_URL) las vuelve absolutas.
 * Next reemplaza `openGraph`/`twitter` enteros por página (no los mezcla con los del layout), por eso se repiten acá.
 */
export function pageMetadata(opts: {
  /** Título sin el sufijo « | EstuRed » (lo agrega el template del layout). */
  title: string;
  description: string;
  /** Ruta canónica, p. ej. "/search". */
  path: string;
  /** `true` para páginas que no deben indexarse (login, etc.). */
  noindex?: boolean;
}): Metadata {
  const { title, description, path, noindex } = opts;
  const ogTitle = `${title} | EstuRed`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "EstuRed", locale: "es_AR", url: path, title: ogTitle, description },
    twitter: { card: "summary", title: ogTitle, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
