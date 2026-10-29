import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { BenefitBento, HOME_BENEFITS } from "@/components/marketing/BenefitBento";
import { HoverFeatureList } from "@/components/ui/HoverFeatureList";
import { HowItWorksSteps } from "@/app/(public)/HowItWorksSteps";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
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

const withEstuRed = [
  {
    label: "Residencias visitadas y verificadas presencialmente",
    detail: "El equipo de EstuRed confirma que existe, que es real y que la información publicada coincide.",
  },
  {
    label: "Precios publicados con política de ajustes explícita",
    detail: "Sabés de antemano bajo qué condiciones puede cambiar un precio, no te enterás después.",
  },
  {
    label: "Solicitud y condiciones registradas en la plataforma",
    detail: "Todo el proceso queda documentado, no depende de capturas de pantalla de un chat.",
  },
  {
    label: "Reserva confirmada con comprobante verificable",
    detail: "Cuando la reserva se confirma, recibís un comprobante con un código que cualquiera puede verificar, y queda registrada para las dos partes.",
  },
  {
    label: "Soporte de EstuRed si algo se traba en el proceso",
    detail: "Hay alguien a quien recurrir si la residencia no responde o algo no queda claro, y te acompañamos a encontrar otra opción.",
  },
];

const outside = [
  {
    label: "Fotos y datos que nadie chequeó",
    detail: "Lo que ves puede no coincidir con la realidad — no hay ninguna verificación presencial de por medio.",
  },
  {
    label: "Precios que cambian de un chat a otro",
    detail: "Sin nada publicado, el precio final puede depender de quién te responda ese día.",
  },
  {
    label: "Acuerdos por WhatsApp que se pierden o se niegan",
    detail: "Sin registro, tu única prueba de lo acordado es tu propia memoria.",
  },
  {
    label: "Señas transferidas sin ningún registro",
    detail: "Si algo sale mal, no tenés ningún registro formal que muestre que pagaste.",
  },
  {
    label: "Nadie a quien recurrir si algo sale mal",
    detail: "Si surge un problema, lo resolvés por tu cuenta.",
  },
];

const audiences = [
  {
    title: "Estudiantes",
    description:
      "Conocé con quién vas a compartir, las reglas, los servicios y la cercanía a tu facultad, todo verificado.",
    href: "/for-students",
    cta: "Cómo funciona para vos",
  },
  {
    title: "Familias",
    description:
      "Sin viajar, acompañá el proceso y sé parte de la decisión: proponé opciones, seguí cada paso y compartí la tranquilidad de una reserva con comprobante verificable.",
    href: "/for-students",
    cta: "Cómo acompañar",
  },
  {
    title: "Residencias",
    description:
      "Menos consultas repetidas, solicitudes completas y herramientas para profesionalizar tu gestión. Hoy, sin costo para residencias verificadas.",
    href: "/for-residences",
    cta: "Sumar mi residencia",
  },
];

const upcoming = [
  {
    title: "Comunidad EstuRed",
    stage: "Ya arrancó",
    description:
      "Hoy ya podés conocer a quienes viven en cada residencia antes de solicitar, según lo que cada residente elige mostrar: nombre, carrera e intereses. Seguimos sumando más señales de cada residente para que conozcas mejor a tus futuros compañeros antes de mudarte.",
  },
  {
    title: "Señales de convivencia",
    stage: "En diseño",
    description:
      "Una primera lectura del estilo de cada casa —ritmos, hábitos y ambiente— construida a partir de lo que ya compartís vos y tus futuros compañeros de cuarto, para elegir donde realmente encajás.",
  },
  {
    title: "Reseñas de residentes",
    stage: "Depende de las primeras estadías",
    description:
      "Las habilitamos apenas las primeras reservas confirmadas completen su primera estadía real: opiniones de gente que efectivamente vivió ahí, no de cualquiera.",
  },
];

const faqs = [
  {
    q: "¿EstuRed es una inmobiliaria?",
    a: "No. EstuRed es una plataforma que conecta estudiantes y familias con residencias estudiantiles verificadas. No alquilamos ni administramos alojamientos. Cobramos un fee por nuestro servicio una vez que la residencia confirma tu pago (mirá «¿Cuánto cuesta usar EstuRed?»).",
  },
  {
    q: "¿Necesito garantía propietaria?",
    a: "No. Las residencias de EstuRed no la piden. Los requisitos de ingreso los ves en la ficha y en el reglamento de cada residencia.",
  },
  {
    q: "¿Cuánto cuesta usar EstuRed?",
    a: "Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado y a EstuRed un fee del 5% sobre tu estadía inicial, sin contar el depósito. El monto exacto lo ves antes de pagar.",
  },
  {
    q: "¿Qué significa que una residencia esté verificada?",
    a: "Que el equipo de EstuRed la visitó presencialmente, validó que existe, que es quien dice ser y que su información publicada es real. Solo las residencias verificadas aparecen en el catálogo.",
  },
  {
    q: "Si una residencia figura con lugar, ¿ya tengo mi lugar?",
    a: "Todavía no. La disponibilidad la informa cada residencia y puede cambiar. Enviás tu solicitud, la residencia revisa tu perfil y confirma si hay lugar. Tu lugar queda reservado cuando la reserva se confirma.",
  },
  {
    q: "¿EstuRed verifica a los estudiantes?",
    a: "No. EstuRed verifica a las residencias, no a las personas. Cada residencia evalúa las solicitudes entrantes y perfiles de forma independiente para asegurar afinidad y buena convivencia.",
  },
  {
    q: "¿Qué recibo cuando se confirma mi reserva?",
    a: "Un Comprobante de Reserva Confirmada emitido por EstuRed, con un código que cualquier persona puede verificar públicamente. Sirve para mostrar que tu reserva quedó confirmada y registrada en EstuRed, a vos y a tu familia.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Abrís un caso de Soporte desde tu reserva. Revisamos lo que pasó, hablamos con la residencia y, si hace falta, te acompañamos para encontrar otra opción. Aplica a diferencias importantes y comprobables; lo que pagaste a la residencia se resuelve con ella, según sus condiciones.",
  },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rate, catalog] = await Promise.all([getCurrentExchangeRate(), getCatalogResidences()]);
  const featured = catalog.slice(0, 3);

  return (
    <>
      {/* Hero (propuesta B: buscador mock + cinta de residencias reales) */}
      <HomeHero residences={catalog} />

      {/* Por qué EstuRed — bento; en mobile, mazo con swipe */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Por qué EstuRed"
          title="Elegir a distancia, con todo a la vista"
          description="Residencias verificadas, costos claros y cada paso registrado."
        />
        <BenefitBento items={HOME_BENEFITS} label="Por qué EstuRed" />
      </section>

      {/* Comparación */}
      <section className="border-y border-sand-200 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeader
            eyebrow="La diferencia"
            title="Reservar con EstuRed vs. reservar por fuera"
            description="Instagram, WhatsApp y los referidos sirven para descubrir. Para decidir y reservar, conviene que todo quede registrado."
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal className="rounded-card border-2 border-line-2 bg-forest-tint/50 p-7">
              <p className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-sm text-white">
                  E
                </span>
                Con EstuRed
              </p>
              <HoverFeatureList items={withEstuRed} icon="check" tone="forest" className="mt-5" />
            </Reveal>
            <Reveal delay={1} className="rounded-card border border-sand-200 bg-sand-50 p-7">
              <p className="font-display text-lg font-bold text-ink-soft">
                Por fuera de EstuRed
              </p>
              <HoverFeatureList items={outside} icon="remove" tone="neutral" className="mt-5" />
            </Reveal>
          </div>
        </div>
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

      {/* Residencias destacadas */}
      {featured.length > 0 && (
        <section className="border-y border-sand-200 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHeader
              eyebrow="Catálogo"
              title="Explorá residencias y conocé cómo es vivir en cada una"
              description="Una muestra de cómo vas a ver cada residencia: compañeros, reglas, disponibilidad y precios claros."
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((residence, i) => (
                <Reveal key={residence.slug} delay={(i as 0 | 1 | 2)}>
                  <ResidenceCard residence={residence} arsPerUsd={rate.arsPerUsd} />
                </Reveal>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button href="/search" variant="outline">
                Ver todas las residencias
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Audiencias */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Para quién es"
          title="Una solución para cada uno"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={(i as 0 | 1 | 2)}>
              <Card interactive className="flex h-full flex-col p-7">
                <h3 className="text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                  {a.description}
                </p>
                <Link
                  href={a.href}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 transition-transform duration-200 ease-bounce hover:translate-x-1"
                >
                  {a.cta} <Icon name="arrow_forward" className="text-base" />
                </Link>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="bg-forest-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-light">
              Lo que viene
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Así seguimos construyendo EstuRed
            </h2>
            <p className="mt-3 text-forest-tint">
              Cada etapa se construye con lo que ya pasa en la plataforma, por eso
              no tienen fecha fija.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {upcoming.map((u, i) => (
              <Reveal
                key={u.title}
                delay={(i as 0 | 1 | 2)}
                className="rounded-card border border-forest-600 bg-forest-600/40 p-6 transition-all duration-300 ease-bounce hover:-translate-y-1 hover:border-orange/60 hover:bg-forest-600/60"
              >
                <p className="inline-flex rounded-full bg-forest-ink/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
                  {u.stage}
                </p>
                <h3 className="mt-3 font-bold">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-tint">
                  {u.description}
                </p>
              </Reveal>
            ))}
          </div>
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
