import type { ComponentProps } from "react";
import { AudiencePanel, StudentMini, FamilyMini, ResidenceMini } from "@/components/ui/AudiencePanel";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerIn } from "@/components/ui/StaggerIn";
import { GuideCard } from "@/components/guides/GuideCard";
import { getFeaturedGuides } from "@/lib/guides/picks";
import Link from "next/link";
import { WhyEstuRed } from "@/components/marketing/WhyEstuRed";
import { HowItWorksSteps } from "@/app/(public)/HowItWorksSteps";
import { ResidenceCardCompact } from "@/components/residences/ResidenceCardCompact";
import { HomeHero } from "@/components/marketing/HomeHero";
import { EsturedSeal } from "@/components/brand/EsturedSeal";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { sortRecommended } from "@/lib/residences/searchFilters";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSlugsWithVisibleProfiles } from "@/lib/residents/communityVisibility";

const steps = [
  {
    title: "Buscá y compará",
    description: "Filtrá por universidad, barrio y precio. Conocé la comunidad.",
    img: "/landing/proceso-1-busqueda.webp",
    imgMobile: "/landing/proceso-1-busqueda-movil.webp",
    alt: "Búsqueda de EstuRed con filtros y tarjetas de residencias verificadas",
  },
  {
    title: "Enviá tu solicitud de reserva",
    description: "Antes de enviarla ves cuánto y a quién pagás, y el reglamento completo. Enviarla es gratis.",
    img: "/landing/proceso-2-solicitud.webp",
    imgMobile: "/landing/proceso-2-solicitud-movil.webp",
    alt: "Ficha de residencia con tarifas por tipo de habitación",
  },
  {
    title: "Esperá la respuesta y pagá",
    description:
      "La residencia tiene 48 horas para responder. Si te acepta, le pagás a ella lo acordado. Cuando confirma tu pago, abonás a EstuRed el 5% de tu estadía inicial.",
    img: "/landing/proceso-4-pago.webp",
    imgMobile: "/landing/proceso-4-pago-movil.webp",
    alt: "Detalle de qué pagás y a quién: a la residencia y el fee EstuRed",
  },
  {
    title: "Recibí tu comprobante de reserva",
    description:
      "Cuando validamos tu pago, tu reserva queda confirmada. Las condiciones y los pagos de la reserva quedan registrados en tu cuenta.",
    img: "/landing/proceso-5-comprobante.webp",
    imgMobile: "/landing/proceso-5-comprobante-movil.webp",
    alt: "Comprobante de Reserva Confirmada",
  },
];

const audiences: Array<
  Omit<ComponentProps<typeof AudiencePanel>, "mini"> & { miniKey: "student" | "family" | "residence" }
> = [
  {
    tone: "student",
    miniKey: "student",
    icon: "backpack",
    who: "Estudiantes",
    promise: "Sabé cómo vas a vivir, antes de mudarte.",
    perks: [
      { icon: "rule", title: "Reglamento completo", text: "Lo leés antes de enviar tu solicitud de reserva." },
      { icon: "directions_walk", title: "Cerca de tu facultad", text: "Ves qué universidades quedan cerca." },
    ],
    href: "/for-students",
    cta: "Ver cómo funciona",
  },
  {
    tone: "family",
    miniKey: "family",
    icon: "family_restroom",
    who: "Familias",
    promise: "Acompañá aunque estés lejos.",
    perks: [
      { icon: "add_comment", title: "Proponé opciones", text: "Vos sugerís, tu estudiante decide." },
      { icon: "receipt_long", title: "Ves el comprobante", text: "Y seguís cada paso de la solicitud." },
    ],
    href: "/for-students#para-familias",
    cta: "Ver cómo acompañar",
  },
  {
    tone: "residence",
    miniKey: "residence",
    icon: "apartment",
    who: "Residencias",
    promise: "Menos mensajes repetidos, mejor gestión.",
    perks: [
      { icon: "how_to_reg", title: "Conocé a quien quiere reservar", text: "Ves su perfil antes de responder." },
      { icon: "dashboard", title: "Todo en un panel", text: "Solicitudes, residentes y renovaciones." },
    ],
    href: "/for-residences",
    cta: "Sumá tu residencia, es gratis",
  },
];

const MINIS = { student: <StudentMini />, family: <FamilyMini />, residence: <ResidenceMini /> };

const faqs = [
  {
    q: "¿EstuRed es una inmobiliaria?",
    a: "No. Te conectamos con residencias verificadas; no alquilamos ni administramos alojamientos.",
    more: "Cobramos un fee por el servicio cuando la residencia confirma tu pago.",
  },
  {
    q: "¿Cuánto cuesta usar EstuRed?",
    a: "Enviar tu solicitud de reserva es gratis. Si la reserva avanza, pagás a la residencia y, aparte, a EstuRed un 5% de tu estadía inicial.",
    more: "Son dos pagos separados. El monto exacto lo ves antes de pagar.",
  },
  {
    q: "¿Qué significa que una residencia esté verificada?",
    a: "La visitamos en persona. Controlamos la identidad del responsable, la dirección y que las fotos coincidan.",
    more: "Solo las verificadas aparecen en el catálogo. Verificamos residencias, no estudiantes.",
  },
  {
    q: "¿Cuándo queda reservado mi lugar?",
    a: "Primero la residencia confirma que recibió tu pago. Después abonás el fee. Cuando lo validamos, tu reserva queda confirmada.",
    more: "Enviar tu solicitud de reserva no te asegura el lugar.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Abrís un caso de Soporte desde tu reserva. Revisamos el caso y hablamos con la residencia.",
    more: "Aplica a diferencias importantes y comprobables. Si hace falta, te ayudamos a buscar otra opción. Lo que pagaste a la residencia se resuelve con ella, según sus condiciones.",
  },
];

/**
 * Landing principal real de EstuRed (la de `/`). Vive acá, como componente, para que la página `app/(public)/page.tsx` y el fondo blureado de
 * la preapertura rendericen EXACTAMENTE lo mismo. `schema={false}` omite el JSON-LD de preguntas frecuentes: el fondo de la preapertura
 * está oculto (inert, aria-hidden) y no debe declarar contenido estructurado.
 */
export async function HomeLanding({ schema = true }: { schema?: boolean }) {
  const featuredGuides = getFeaturedGuides(3);
  const [rate, rawCatalog] = await Promise.all([getCurrentExchangeRate(), getCatalogResidences()]);
  const catalog = sortRecommended(rawCatalog); // DR24
  const featured = catalog.slice(0, 4);
  const admin = getSupabaseAdmin();
  const withCommunity = admin
    ? await getSlugsWithVisibleProfiles(admin, featured.map((r) => r.slug))
    : new Set<string>();

  return (
    <>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {/* Hero (propuesta B: buscador mock + cinta de residencias reales) */}
      <HomeHero residences={catalog} intro={schema} />

      {/* Paso a paso (DR68): lo primero bajo el carrusel */}
      <div className="bg-paper">
        <section id="el-proceso" className="mx-auto max-w-6xl scroll-mt-20 overflow-x-clip px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeader
            align="left"
            title="Reservá en 4 pasos, sin viajar a Buenos Aires"
            description="No hace falta ir a verlas: ya las visitamos nosotros."
          />
          <HowItWorksSteps steps={steps} />
        </section>
      </div>

      {/* Por qué EstuRed (fusionada con «La diferencia», DR22) */}
      <WhyEstuRed />

      {/* Catálogo (tarjetas reducidas) */}
      <div className="band">
<section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-10 flex items-start justify-between gap-4 sm:gap-8">
          <div className="[&>div]:mb-0">
            <SectionHeader
              align="left"
              {...(withCommunity.size > 0
                ? {
                    eyebrow: "Residencias verificadas en CABA",
                    title: "Conocé la comunidad antes de elegir",
                    description:
                      "Con tu cuenta, podés ver los perfiles de quienes ya están en la resi, qué estudian, sus intereses y preferencias.",
                  }
                : { title: "Residencias verificadas en CABA" })}
            />
          </div>
          <Reveal className="shrink-0">
            <EsturedSeal size={156} className="-mt-1 size-[84px] sm:mt-0 sm:size-[132px] lg:size-[156px]" />
          </Reveal>
        </div>
        {featured.length > 0 ? (
          <>
            <StaggerIn role="region" aria-label="Residencias del catálogo" tabIndex={0} className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {featured.map((residence) => (
                <div key={residence.slug} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <ResidenceCardCompact
                    residence={residence}
                    arsPerUsd={rate.arsPerUsd}
                    showCommunity={withCommunity.has(residence.slug)}
                  />
                </div>
              ))}
            </StaggerIn>
            <div className="mt-8">
              <Button href="/search" variant="outline">
                Ver todas las residencias
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon="apartment"
            title="Estamos sumando residencias"
            description="Volvé pronto: estamos verificando las primeras."
          />
        )}
      </section>
</div>

      {/* Audiencias */}
      <div className="surface-glow surface-grain">
<section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          align="left"
          title="¿Desde qué lado llegás?"
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-0">
          {audiences.map(({ miniKey, ...a }, i) => (
            <Reveal
              key={a.who}
              delay={i as 0 | 1 | 2}
              className={`h-full lg:row-span-4 lg:grid lg:grid-rows-subgrid ${i === 2 ? "md:col-span-2 lg:col-span-1" : ""}`}
            >
              <AudiencePanel {...a} mini={MINIS[miniKey]} />
            </Reveal>
          ))}
        </div>
      </section>
</div>

      {/* Centro de Guías: 3 destacadas, entre «Para quién es» y las preguntas frecuentes */}
      {featuredGuides.length > 0 && (
        <section aria-label="Centro de Guías" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader
            eyebrow="Centro de Guías"
            align="left"
            title="Antes de decidir, informate"
            description="Para elegir residencia y mudarte a Buenos Aires."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredGuides.map((g) => (
              <GuideCard key={g.id} guide={g} />
            ))}
          </div>
          <p className="mt-6">
            <Link href="/guias" className="text-sm font-bold text-forest-700 hover:underline">
              Ver todas las guías
            </Link>
          </p>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader align="left" title="Preguntas frecuentes" />
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
              <details className="group rounded-card border border-sand-200 bg-surface p-5 transition-shadow open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink marker:hidden">
                  {faq.q}
                  <span aria-hidden="true" className="text-forest-600 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  {faq.a}
                </p>
                <details className="mt-2">
                  <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-sm font-semibold text-forest-700 marker:hidden hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    Ver más
                  </summary>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{faq.more}</p>
                </details>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="font-display text-2xl font-bold text-ink sm:text-3xl">
            La convivencia también se elige.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Ya podés buscar, comparar y enviar tu solicitud de reserva a las
            primeras residencias verificadas de Buenos Aires.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href="/search" size="lg">
              Buscar residencia
            </Button>
            <Button href="/register" size="lg" variant="outline">
              Crear cuenta
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
