import { SITE_URL } from "@/lib/siteUrl";

/** JSON-LD de entidad de marca (Organization + WebSite) para el layout raíz. Sin SearchAction: /search no soporta `?q=`. */
export function siteJsonLd(): string {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "EstuRed",
        url: SITE_URL,
        logo: `${SITE_URL}/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "EstuRed",
        url: SITE_URL,
        inLanguage: "es-AR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
