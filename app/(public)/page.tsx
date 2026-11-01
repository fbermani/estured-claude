import type { ComponentProps } from "react";
import { AudiencePanel, StudentMini, FamilyMini, ResidenceMini } from "@/components/ui/AudiencePanel";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { WhyEstuRed } from "@/components/marketing/WhyEstuRed";
import { HowItWorksSteps } from "@/app/(public)/HowItWorksSteps";
import { ResidenceCardCompact } from "@/components/residences/ResidenceCardCompact";
import { HomeHero } from "@/components/marketing/HomeHero";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";

const steps = [
  {
    slogan: "Buscá sin viajar",
    title: "Buscás tu residencia",
    description: "Filtrá por universidad, barrio y precio. Mirá reglas, servicios, disponibilidad y quiénes viven ahí.",
    img: "/landing/proceso-1-busqueda.webp",
    alt: "Búsqueda de EstuRed con filtros y tarjetas de residencias verificadas",
  },
  {
    slogan: "Solicitá gratis",
    title: "Enviás tu solicitud",
    description: "Elegís el tipo de habitación y enviás tu solicitud sin costo. Tu familia puede acompañarte.",
    img: "/landing/proceso-2-solicitud.webp",
    alt: "Ficha de residencia con tarifas por tipo de habitación y selector para solicitar",
  },
  {
    slogan: "Vos decidís",
    title: "La residencia te responde",
    description: "Acepta tu solicitud o te propone un ajuste. Seguís cada paso y decidís si avanzás.",
    img: "/landing/proceso-3-respuesta.webp",
    alt: "Seguimiento de la solicitud con los pasos completados",
  },
  {
    slogan: "Pago directo",
    title: "Abonás tu reserva",
    description: "Pagás directo a la residencia lo acordado. Ella confirma que lo recibió.",
    img: "/landing/proceso-4-pago.webp",
    alt: "Detalle de qué pagás y a quién: a la residencia y el fee EstuRed",
  },
  {
    slogan: "Comprobante verificable",
    title: "Confirmás tu reserva",
    description: "Abonás el fee EstuRed (5%) y obtenés tu Comprobante de Reserva Confirmada.",
    img: "/landing/proceso-5-comprobante.webp",
    alt: "Comprobante de Reserva Confirmada con número verificable",
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
    promise: "Sabé con quién y cómo vas a vivir, antes de mudarte.",
    perks: [
      { icon: "groups", title: "Conocé a tus futuros compañeros", text: "Perfiles que cada residente decide mostrar." },
      { icon: "rule", title: "Reglas y servicios, sin sorpresas", text: "Lo principal en la ficha y el reglamento completo." },
      { icon: "verified", title: "Verificada por EstuRed", text: "Revisamos responsable, ubicación y fotos." },
    ],
    href: "/for-students",
    cta: "Ver cómo funciona para vos",
    note: "Explorar es gratis",
  },
  {
    tone: "family",
    miniKey: "family",
    icon: "family_restroom",
    who: "Familias",
    promise: "Acompañá sin viajar. Ser parte, con tranquilidad.",
    perks: [
      { icon: "home_pin", title: "Todo a distancia", text: "Sin viajar a Buenos Aires." },
      { icon: "add_comment", title: "Proponé opciones", text: "Vos sugerís, tu estudiante decide." },
      { icon: "verified_user", title: "Comprobante que cualquiera puede verificar", text: "Queda todo registrado." },
    ],
    href: "/for-students#para-familias",
    cta: "Ver cómo acompañar",
    note: "Toda solicitud queda sujeta a confirmación de la residencia",
  },
  {
    tone: "residence",
    miniKey: "residence",
    icon: "apartment",
    who: "Residencias",
    promise: "Recibí solicitudes completas, no consultas repetidas.",
    badge: "Perfil Verificado gratuito",
    perks: [
      { icon: "inbox", title: "Menos preguntas de siempre", text: "La ficha responde por vos." },
      { icon: "how_to_reg", title: "Vos decidís a quién aceptar", text: "Con el perfil a la vista." },
      { icon: "dashboard", title: "Herramientas para ordenar tu gestión", text: "Habitaciones, plazas y solicitudes en un lugar." },
    ],
    href: "/for-residences",
    cta: "Solicitar sumar mi residencia",
    note: "Primero revisamos tu residencia y su responsable",
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
    a: "Solicitar es gratis. Si la reserva avanza, pagás a la residencia y, aparte, a EstuRed un 5% de la estadía inicial, sin depósito.",
    more: "Son dos pagos separados. El monto exacto lo ves antes de pagar.",
  },
  {
    q: "¿Qué significa que una residencia esté verificada?",
    a: "Que EstuRed chequeó que existe, quién la gestiona y que lo publicado es real.",
    more: "Revisamos responsable, ubicación y fotos antes de publicar. Solo las residencias verificadas aparecen en el catálogo.",
  },
  {
    q: "Si una residencia figura con lugar, ¿ya tengo mi lugar?",
    a: "Todavía no. La disponibilidad la informa cada residencia; tu lugar queda reservado cuando la reserva se confirma.",
    more: "Puede cambiar. Enviás tu solicitud, la residencia revisa tu perfil y confirma si hay lugar.",
  },
  {
    q: "¿EstuRed verifica a los estudiantes?",
    a: "No. EstuRed verifica residencias; cada residencia evalúa las solicitudes que recibe.",
    more: "Lo hace por su cuenta, pensando en la convivencia.",
  },
  {
    q: "¿Qué recibo cuando se confirma mi reserva?",
    a: "Un Comprobante de Reserva Confirmada de EstuRed, con un código que cualquiera puede verificar.",
    more: "Sirve para mostrarles a vos y a tu familia que la reserva quedó registrada.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Abrís un caso de Soporte desde tu reserva. Revisamos el caso y hablamos con la residencia.",
    more: "Aplica a diferencias importantes y comprobables. Si hace falta, te ayudamos a buscar otra opción. Lo que pagaste a la residencia se resuelve con ella, según sus condiciones.",
  },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rate, catalog] = await Promise.all([getCurrentExchangeRate(), getCatalogResidences()]);
  const featured = catalog.slice(0, 4);

  return (
    <>
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
      {/* Hero (propuesta B: buscador mock + cinta de residencias reales) */}
      <HomeHero residences={catalog} />

      {/* Por qué EstuRed (fusionada con «La diferencia», DR22) */}
      <WhyEstuRed />

      {/* Catálogo (tarjetas reducidas) */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Catálogo"
          title="Residencias verificadas en CABA"
          description="Precios y reglas a la vista. La disponibilidad la informa cada residencia."
        />
        {featured.length > 0 ? (
          <>
            <div role="region" aria-label="Residencias del catálogo" tabIndex={0} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {featured.map((residence) => (
                <div key={residence.slug} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <ResidenceCardCompact residence={residence} arsPerUsd={rate.arsPerUsd} />
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button href="/search" variant="outline">
                Ver todas las residencias
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon="apartment"
            title="Estamos sumando residencias"
            description="Volvé pronto o dejanos tu mail."
            action={<Button href="/waitlist" variant="outline">Dejar mi mail</Button>}
          />
        )}
      </section>

      {/* Cómo funciona */}
      <section id="el-proceso" className="mx-auto max-w-6xl scroll-mt-20 overflow-x-clip px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="El proceso"
          title="De la búsqueda a tu reserva confirmada, sin viajar a Buenos Aires"
          description="Cinco pasos desde donde estés. Cada uno queda registrado."
        />
        <p className="-mt-4 mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft-100 px-3 py-1.5 text-[13px] font-bold text-amber-soft-700">
            <Icon name="home_pin" className="text-lg" /> Todo a distancia
          </span>
        </p>
        <HowItWorksSteps steps={steps} />
      </section>

      {/* Audiencias */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Para quién es"
          title="Cada uno con su lugar en el proceso"
          description="Quien estudia elige. La familia acompaña. La residencia recibe solicitudes completas."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {audiences.map(({ miniKey, ...a }, i) => (
            <Reveal
              key={a.who}
              delay={i as 0 | 1 | 2}
              className={`h-full ${i === 2 ? "md:col-span-2 lg:col-span-1" : ""}`}
            >
              <AudiencePanel {...a} mini={MINIS[miniKey]} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader eyebrow="Preguntas frecuentes" title="Dudas comunes" />
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
          <p className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
            La convivencia también se elige.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Ya podés buscar, comparar y enviar tu solicitud a las primeras
            residencias verificadas de Buenos Aires.
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
