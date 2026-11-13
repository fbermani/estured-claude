import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { BrandDivider } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Breadcrumbs } from "@/components/guides/Breadcrumbs";
import { GuideBody } from "@/components/guides/GuideBody";
import { GuideCard } from "@/components/guides/GuideCard";
import { GuideToc } from "@/components/guides/GuideToc";
import { Inline } from "@/components/guides/Inline";
import { ReadingProgress } from "@/components/guides/ReadingProgress";
import { getAllGuides, getGuideBySlug, getRelatedGuides, toSummary } from "@/lib/guides/load";
import { AUDIENCE_META, CATEGORY_META } from "@/lib/guides/taxonomy";
import { SITE_URL } from "@/lib/siteUrl";

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Guía no encontrada", robots: { index: false, follow: false } };
  const path = guide.seo.canonical ?? `/guias/${guide.slug}`;
  return {
    title: guide.seo.title,
    description: guide.seo.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: "EstuRed",
      locale: "es_AR",
      url: path,
      title: guide.seo.title,
      description: guide.seo.description,
      ...(guide.heroImage ? { images: [{ url: guide.heroImage.src }] } : {}),
    },
  };
}

/** JSON-LD seguro para incrustar en <script> (escapa `<`). */
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const cat = CATEGORY_META[guide.category];
  const related = getRelatedGuides(guide);
  const url = `${SITE_URL}/guias/${guide.slug}`;
  const toc = guide.sections.map((s) => ({ id: s.id, label: s.heading }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: guide.title, item: url },
    ],
  };
  // Sin fechas inventadas: datePublished/dateModified solo si el frontmatter trae una fecha verificada.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "es-AR",
    mainEntityOfPage: url,
    ...(guide.heroImage ? { image: guide.heroImage.src.startsWith("http") ? guide.heroImage.src : `${SITE_URL}${guide.heroImage.src}` } : {}),
    ...(guide.updatedAt || guide.reviewedAt ? { dateModified: guide.updatedAt ?? guide.reviewedAt } : {}),
    author: guide.author ? { "@type": "Person", name: guide.author } : { "@type": "Organization", name: "EstuRed", url: SITE_URL },
    publisher: { "@type": "Organization", name: "EstuRed", url: SITE_URL },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleLd) }} />
      <ReadingProgress targetId="guia-articulo" />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Guías", href: "/guias" }, { label: guide.title }]} />

        <header className={`relative mt-3 overflow-hidden rounded-card bg-gradient-to-br ${cat.gradient} px-5 py-8 sm:px-9 sm:py-11`}>
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 size-56 rounded-full bg-white/40" />
          <Icon name={cat.icon} className="pointer-events-none absolute -bottom-4 right-6 text-[120px]! leading-none opacity-20 sm:text-[160px]!" />
          <div className="relative max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" className="bg-white/80 font-semibold">
                <Icon name={cat.icon} className="text-sm!" />
                {cat.label}
              </Badge>
              {guide.eyebrow && <span className="text-xs font-bold text-ink-soft">{guide.eyebrow}</span>}
            </div>
            <h1 className="mt-3 font-display text-[1.75rem] font-bold leading-[1.1] text-ink sm:text-4xl lg:text-[2.6rem]">{guide.title}</h1>
            {guide.lede && (
              <p className="mt-3 max-w-2xl text-base text-ink-soft sm:text-lg">
                <Inline text={guide.lede} />
              </p>
            )}
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <Icon name="schedule" className="text-lg!" />
                {guide.readMinutes} min de lectura
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="group" className="text-lg!" />
                {guide.audience.map((a) => AUDIENCE_META[a].label).join(", ")}
              </span>
              {guide.reviewedAt && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="event_available" className="text-lg!" />
                  Revisada el {new Date(guide.reviewedAt + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12">
          <aside>
            <GuideToc items={toc} />
          </aside>

          <div className="min-w-0 max-w-[44rem]">
            <article id="guia-articulo">
              <GuideBody sections={guide.sections} />
            </article>

            <BrandDivider className="mt-10" />

            {guide.cta && (
              <div className="mt-10 flex flex-col items-start gap-3 rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <p className="font-display text-lg font-bold text-ink">Seguí con EstuRed</p>
                <Button href={guide.cta.href} variant="secondary">
                  {guide.cta.label}
                  <Icon name="arrow_forward" className="text-xl!" />
                </Button>
              </div>
            )}

            {guide.closingNote && (
              <p className="mt-8 flex gap-3 border-t border-line pt-6 text-sm leading-relaxed text-ink-soft">
                <Icon name="explore" className="mt-0.5 flex-none text-xl! text-forest-700" />
                <span>
                  <Inline text={guide.closingNote} />
                </span>
              </p>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="segui-leyendo" className="mt-14">
            <h2 id="segui-leyendo" className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Seguí leyendo
            </h2>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((g) => (
                <li key={g.id}>
                  <GuideCard guide={toSummary(g)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10">
          <Link
            href="/guias"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-bold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <Icon name="arrow_back" className="text-xl!" />
            Ver todas las guías
          </Link>
        </p>
      </div>
    </>
  );
}
