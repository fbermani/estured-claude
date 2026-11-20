import { SITE_URL } from "@/lib/siteUrl";

type Input = {
  slug: string;
  name: string;
  description?: string | null;
  addressLine?: string | null;
  area?: string | null;
  /** Coordenadas SOLO si son las de la residencia (no el centro aproximado del barrio). */
  geo?: { lat: number; lng: number } | null;
  photoUrl?: string | null;
  /** Precios mensuales en USD de los tipos de habitación (con promoción aplicada). */
  pricesUsd: number[];
  /** Servicios incluidos (nombres visibles en la ficha). */
  amenities: string[];
  /** Preguntas frecuentes visibles en la ficha (sin las de visitantes). */
  faq: { question: string; answer: string }[];
};

const fmt = (n: number) => String(Math.round(n));

/**
 * JSON-LD de la ficha: LodgingBusiness + BreadcrumbList (+ FAQPage si hay FAQ visible).
 * Reglas del proyecto: sin `aggregateRating`/`review` (no hay reseñas verificadas) y sin `availability`/`Offer` (no se promete disponibilidad).
 */
export function residenceJsonLd(i: Input): string {
  const url = `${SITE_URL}/residencias/${i.slug}`;
  const prices = i.pricesUsd.filter((p) => Number.isFinite(p) && p > 0);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const description = i.description?.trim().slice(0, 1000);
  const amenities = [...new Set(i.amenities.map((a) => a.trim()).filter(Boolean))].slice(0, 25);
  const faq = i.faq.filter((f) => f.question.trim() && f.answer.trim());

  const lodging = {
    "@type": "LodgingBusiness",
    "@id": `${url}#residencia`,
    name: i.name,
    url,
    ...(description ? { description } : {}),
    address: {
      "@type": "PostalAddress",
      ...(i.addressLine ? { streetAddress: i.addressLine } : {}),
      addressLocality: i.area || "Ciudad Autónoma de Buenos Aires",
      addressRegion: "CABA",
      addressCountry: "AR",
    },
    ...(i.geo ? { geo: { "@type": "GeoCoordinates", latitude: i.geo.lat, longitude: i.geo.lng } } : {}),
    ...(i.photoUrl ? { image: i.photoUrl } : {}),
    ...(min != null && max != null ? { priceRange: min === max ? `USD ${fmt(min)} por mes` : `USD ${fmt(min)} - USD ${fmt(max)} por mes` } : {}),
    ...(amenities.length ? { amenityFeature: amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) } : {}),
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Residencias", item: `${SITE_URL}/search` },
      { "@type": "ListItem", position: 3, name: i.name, item: url },
    ],
  };

  const graph: object[] = [lodging, breadcrumb];
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question.trim(), acceptedAnswer: { "@type": "Answer", text: f.answer.trim() } })),
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
