import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { RotatingBenefits, type RotatingBenefit } from "@/components/ui/RotatingBenefits";
import { HoverFeatureList } from "@/components/ui/HoverFeatureList";
import { HowItWorksSteps } from "@/app/(public)/HowItWorksSteps";
import { WhatYouPay } from "@/components/marketing/WhatYouPay";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";

const pillars: RotatingBenefit[] = [
  {
    icon: "verified",
    title: "Información verificada",
    summary:
      "Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial antes de publicarse.",
    problem:
      "Cuando buscás a distancia, solo tenés fotos y descripciones que nadie revisó. Es difícil saber si coinciden con el lugar antes de pagar una seña.",
    solution:
      "Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial antes de publicarse. Revisamos cada espacio en persona: fotos auténticas, servicios reales y reglas claras. El sello Residencia Verificada no reemplaza que consultes las condiciones de tu estadía.",
    conclusion: "Elegís con información revisada en persona.",
  },
  {
    icon: "description",
    title: "Solicitud registrada",
    summary:
      "Tu solicitud, la respuesta de la residencia y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada depende de un chat que se pierde.",
    problem:
      "Un acuerdo por chat se puede perder o editar, y después cuesta saber qué quedó acordado.",
    solution:
      "Tu solicitud, la respuesta de la residencia y cualquier ajuste de condiciones quedan registrados en la plataforma, con fecha y estado siempre visibles.",
    conclusion: "Todo el proceso queda por escrito, no en un chat que se borra.",
  },
  {
    icon: "receipt_long",
    title: "Registro verificable",
    summary:
      "Cuando tu reserva se confirma, EstuRed la registra con un código público. Un registro claro para vos y tu familia.",
    problem:
      "Transferir una seña sin ningún registro deja dudas, para vos y para quien te ayuda a pagar.",
    solution:
      "Cuando tu reserva se confirma, EstuRed emite tu Comprobante de Reserva Confirmada, con un código que cualquier persona puede verificar públicamente.",
    conclusion: "Un registro verificable, no una captura de un chat.",
  },
  {
    icon: "sell",
    title: "Costos a la vista",
    summary:
      "Ves el monto exacto del fee de EstuRed antes de pagar: el 5% de tu estadía inicial, sin contar el depósito.",
    problem:
      "Los costos que aparecen recién cuando ya avanzaste generan desconfianza, sobre todo si pagás a distancia.",
    solution:
      "Ves el monto exacto del fee de EstuRed antes de pagar: el 5% de tu estadía inicial, sin contar el depósito. A la residencia le pagás directamente lo acordado.",
    conclusion: "Sabés cuánto vas a pagar y a quién, antes de pagar.",
  },
  {
    icon: "support_agent",
    title: "Soporte de EstuRed",
    summary:
      "Si algo no coincide con lo publicado, abrís un caso de Soporte desde tu reserva.",
    problem:
      "Si al llegar algo no coincide con lo que se publicó, resolverlo solo, a distancia, es difícil.",
    solution:
      "Si algo no coincide con lo publicado, abrís un caso de Soporte desde tu reserva. Revisamos la evidencia y, según el caso, puede corresponder la devolución del fee EstuRed.",
    conclusion: "Tenés a quién recurrir si algo no coincide.",
  },
];

const steps = [
  {
    title: "Buscás con contexto real",
    description:
      "Filtrá por barrio, tipo de habitación y presupuesto. Cada ficha muestra reglas, servicios, universidades cercanas y disponibilidad.",
    detail: "Ver reglas y disponibilidad antes de escribir evita perder tiempo con residencias que no son para vos.",
  },
  {
    title: "Enviás tu solicitud",
    description:
      "Es gratis y queda registrada en la plataforma. La residencia revisa tu perfil y te responde. Un familiar también puede proponerte opciones.",
    detail: "Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.",
  },
  {
    title: "Acordás las condiciones",
    description:
      "La residencia confirma tus condiciones o te propone un único ajuste antes de confirmar. Vos siempre tenés la última palabra.",
    detail: "Si te proponen un ajuste, sos vos quien decide aceptarlo o no — nunca queda forzado.",
  },
  {
    title: "Pagás a la residencia",
    description:
      "Le pagás directamente lo acordado para reservar, por ejemplo el primer mes o la matrícula. La residencia confirma que lo recibió.",
    detail: "EstuRed no cobra ese dinero: queda registrado que la residencia lo recibió.",
  },
  {
    title: "Pagás el fee EstuRed y se confirma tu reserva",
    description:
      "Pagás a EstuRed un fee del 5% de tu estadía inicial, sin contar el depósito. Ves el monto exacto antes de pagar. Con el fee pago, tu reserva queda confirmada y recibís el Comprobante de Reserva Confirmada.",
    detail: "Queda registrada con un código que cualquier persona puede verificar.",
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
    label: "Reserva confirmada con código verificable",
    detail: "Cada reserva confirmada queda registrada con un código verificable, para las dos partes.",
  },
  {
    label: "Soporte de EstuRed si algo se traba en el proceso",
    detail: "Hay alguien a quien recurrir si la residencia no responde o algo no queda claro.",
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
      "Elegí dónde y con quiénes vas a vivir con información real: convivencia, reglas, servicios y cercanía a tu facultad.",
    href: "/for-students",
    cta: "Cómo funciona para vos",
  },
  {
    title: "Familias",
    description:
      "Acompañá la decisión a la distancia: proponé opciones, seguí cada paso del proceso y la reserva confirmada queda con un código verificable.",
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
    a: "No. EstuRed verifica a las residencias, no a las personas. Vos elegís qué mostrás en tu perfil, y cada residencia revisa las solicitudes que recibe antes de confirmar.",
  },
  {
    q: "¿Qué recibo cuando se confirma mi reserva?",
    a: "Un Comprobante de Reserva Confirmada emitido por EstuRed, con un código que cualquier persona puede verificar públicamente. Sirve para mostrar que tu reserva quedó confirmada y registrada en EstuRed, a vos y a tu familia.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Podés abrir un caso de Soporte desde tu reserva. Revisamos la evidencia y, según el caso, puede corresponder la devolución del fee EstuRed. Más detalle en «Si algo no coincide con lo publicado».",
  },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rate, catalog] = await Promise.all([getCurrentExchangeRate(), getCatalogResidences()]);
  const heroResidence = catalog[0] ?? null;
  const featured = catalog.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden bg-sand-100">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <Reveal>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-forest-700 sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-600" aria-hidden />
              Primera etapa: Ciudad de Buenos Aires
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">
              No solo elijas dónde vivir,{" "}
              <span className="text-forest-700">sino cómo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Residencias estudiantiles verificadas en CABA, cerca de tu
              facultad, con información clara, solicitudes registradas y un
              registro verificable cuando se confirma tu reserva.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/search" size="lg">
                Buscar residencia en CABA
              </Button>
              <Button href="/for-residences" variant="outline" size="lg">
                Sumar mi residencia
              </Button>
            </div>
            <p className="mt-5 text-xs text-ink-faint">
              Enviar una solicitud es gratis. La residencia revisa tu perfil y
              confirma si hay lugar.
            </p>
          </Reveal>

          {/* Composición de producto — la señal central de EstuRed (el
              comprobante verificable) es lo primero que se asienta */}
          {heroResidence && (
            <Reveal delay={2} className="relative mx-auto w-full max-w-sm lg:max-w-none">
              <ResidenceCard residence={heroResidence} arsPerUsd={rate.arsPerUsd} />
              <div className="absolute -right-3 -top-5 hidden max-w-[240px] rotate-2 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block lg:-right-6">
                <p className="flex items-start gap-2 text-xs font-bold leading-snug text-ink">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                    <Icon name="check" className="text-base" />
                  </span>
                  Comprobante de Reserva Confirmada
                </p>
                <p className="mt-1 pl-8 font-mono text-[11px] text-ink-faint">
                  ER-2027-0413
                </p>
              </div>
              <div className="absolute -bottom-4 -left-3 hidden -rotate-1 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block lg:-left-6">
                <p className="text-xs font-bold text-ink">
                  Solicitud registrada
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Condiciones claras, sin idas y vueltas por chat
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* Por qué EstuRed — interactivo, rota solo y se puede explorar con clicks */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Por qué EstuRed"
          title="Elegir a distancia, con todo a la vista"
          description="Reservar a distancia genera dudas. En EstuRed cada paso es claro, las residencias están verificadas y todo queda registrado."
        />
        <RotatingBenefits items={pillars} />
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="El proceso"
          title="De la búsqueda a tu reserva confirmada, en cinco pasos"
          description="Cada paso queda registrado, con las mismas reglas para estudiantes, familias y residencias."
        />
        <HowItWorksSteps steps={steps} />
      </section>

      {/* Qué pagás y a quién */}
      <div className="border-y border-sand-200 bg-surface">
        <WhatYouPay variant="short" />
      </div>

      {/* Residencias destacadas */}
      {featured.length > 0 && (
        <section className="border-y border-sand-200 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHeader
              eyebrow="Catálogo"
              title="Explorá opciones con contexto real"
              description="Una muestra de cómo vas a ver cada residencia: verificación, disponibilidad, precios claros y universidades cercanas."
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
