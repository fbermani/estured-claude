import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { ResidenceCard } from "@/components/residences/ResidenceCard";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";

const pillars = [
  {
    title: "Información verificada",
    description:
      "Cada residencia fue visitada presencialmente por el equipo de EstuRed. Fotos, servicios, reglas y precios chequeados antes de publicarse.",
    icon: "verified",
  },
  {
    title: "Solicitud registrada",
    description:
      "Tu solicitud, la respuesta de la residencia y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada depende de un chat que se pierde.",
    icon: "description",
  },
  {
    title: "Comprobante verificable",
    description:
      "Cuando tu reserva se confirma, EstuRed emite un Comprobante de Reserva Confirmada con código público. Respaldo real para vos y tu familia.",
    icon: "receipt_long",
  },
];

const steps = [
  {
    title: "Buscá con contexto real",
    description:
      "Filtrá por barrio, tipo de habitación y presupuesto. Cada ficha muestra reglas, servicios, universidades cercanas y disponibilidad.",
  },
  {
    title: "Enviá tu solicitud",
    description:
      "Queda registrada en la plataforma. La residencia la revisa y te responde. Un familiar también puede proponer opciones para acompañarte.",
  },
  {
    title: "Acordá las condiciones",
    description:
      "La residencia confirma tus condiciones o te propone un único ajuste antes de confirmar. Vos siempre tenés la última palabra.",
  },
  {
    title: "Reservá con comprobante",
    description:
      "Confirmada la reserva, recibís tu Comprobante de Reserva Confirmada con código verificable por cualquier persona.",
  },
];

const withEstuRed = [
  "Residencias visitadas y verificadas presencialmente",
  "Precios publicados con política de ajustes explícita",
  "Solicitud y condiciones registradas en la plataforma",
  "Comprobante de Reserva Confirmada con código verificable",
  "Soporte de EstuRed si algo se traba en el proceso",
];

const outside = [
  "Fotos y datos que nadie chequeó",
  "Precios que cambian de un chat a otro",
  "Acuerdos por WhatsApp que se pierden o se niegan",
  "Señas transferidas sin comprobante ni respaldo",
  "Nadie a quien recurrir si algo sale mal",
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
      "Acompañá la decisión a la distancia: proponé opciones, seguí cada paso del proceso y quedate con un comprobante respaldado.",
    href: "/for-students",
    cta: "Cómo acompañar",
  },
  {
    title: "Residencias",
    description:
      "Menos consultas repetidas, solicitudes completas y herramientas para profesionalizar tu gestión. Empezá gratis.",
    href: "/for-residences",
    cta: "Sumar mi residencia",
  },
];

const upcoming = [
  {
    title: "Comunidad EstuRed",
    stage: "Ya arrancó",
    description:
      "Hoy ya podés ver quién vive en cada residencia antes de aplicar: nombre, carrera, intereses. Seguimos sumando más señales de cada residente para que conozcas mejor a tus futuros compañeros antes de mudarte.",
  },
  {
    title: "Señales de convivencia",
    stage: "En diseño",
    description:
      "Una primera lectura del estilo de cada casa —ritmos, hábitos y ambiente— construida a partir de lo que ya compartís vos y tus futuros compañeros de cuarto, para elegir donde realmente encajás.",
  },
  {
    title: "Reseñas verificadas",
    stage: "Depende de las primeras estadías",
    description:
      "Las habilitamos apenas las primeras reservas confirmadas completen su primera estadía real: opiniones de gente que efectivamente vivió ahí, no de cualquiera.",
  },
];

const faqs = [
  {
    q: "¿EstuRed es una inmobiliaria?",
    a: "No. EstuRed es una plataforma que conecta estudiantes y familias con residencias estudiantiles verificadas. No alquilamos departamentos ni cobramos comisiones inmobiliarias: ayudamos a que elegir y reservar sea claro, registrado y confiable.",
  },
  {
    q: "¿Qué significa que una residencia esté verificada?",
    a: "Que el equipo de EstuRed la visitó presencialmente, validó que existe, que es quien dice ser y que su información publicada es real. Solo las residencias verificadas aparecen en el catálogo.",
  },
  {
    q: "¿Ver una residencia disponible garantiza mi lugar?",
    a: "No. La disponibilidad publicada es informativa y toda reserva está sujeta a la confirmación de la residencia. Por eso hablamos siempre de solicitudes: enviás la tuya y la residencia la confirma.",
  },
  {
    q: "¿Qué recibo cuando se confirma mi reserva?",
    a: "Un Comprobante de Reserva Confirmada emitido por EstuRed, con un código que cualquier persona puede verificar públicamente. Es el respaldo de que tu reserva quedó registrada, para vos y tu familia.",
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
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-forest-700 sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-600" aria-hidden />
              Primera etapa: Buenos Aires · Próximamente, Latinoamérica
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.08] text-ink sm:text-5xl lg:text-[3.4rem]">
              No solo elijas dónde vivir,{" "}
              <span className="text-forest-700">sino cómo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Residencias estudiantiles verificadas en CABA, cerca de tu
              facultad, con información clara, solicitudes registradas y una
              reserva con comprobante respaldado.
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
              La disponibilidad publicada es informativa. Toda reserva está
              sujeta a confirmación de la residencia.
            </p>
          </div>

          {/* Composición de producto */}
          {heroResidence && (
            <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
              <ResidenceCard residence={heroResidence} arsPerUsd={rate.arsPerUsd} />
              <div className="absolute -right-3 -top-5 hidden max-w-[240px] rotate-2 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 sm:block lg:-right-6">
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
              <div className="absolute -bottom-4 -left-3 hidden -rotate-1 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 sm:block lg:-left-6">
                <p className="text-xs font-bold text-ink">
                  Solicitud registrada
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Condiciones claras, sin idas y vueltas por chat
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Pilares de confianza */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="Por qué EstuRed"
          title="La incertidumbre termina acá"
          description="Reservar a distancia solía ser un acto de fe. Con EstuRed es un proceso claro, verificado y registrado de punta a punta."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <Card key={p.title} className="p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-tint text-forest-700">
                <Icon name={p.icon} className="text-2xl" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {p.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparación */}
      <section className="border-y border-sand-200 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeader
            eyebrow="La diferencia"
            title="Reservar con EstuRed vs. reservar por fuera"
            description="Instagram, WhatsApp y los referidos sirven para descubrir. Para decidir y reservar, necesitás respaldo."
          />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-card border-2 border-line-2 bg-forest-tint/50 p-7">
              <p className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-sm text-white">
                  E
                </span>
                Con EstuRed
              </p>
              <ul className="mt-5 space-y-3.5">
                {withEstuRed.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-ink">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                      <Icon name="check" className="text-sm" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-sand-200 bg-sand-50 p-7">
              <p className="font-display text-lg font-bold text-ink-soft">
                Por fuera, a pulmón
              </p>
              <ul className="mt-5 space-y-3.5">
                {outside.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-ink-soft">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand-200 text-xs font-bold text-ink-faint">
                      –
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader
          eyebrow="El proceso"
          title="De la búsqueda al comprobante, en cuatro pasos"
          description="Cada paso queda registrado, con las mismas reglas para estudiantes, familias y residencias."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <Card className="h-full p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-tint font-display text-lg font-extrabold text-orange-700">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {step.description}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </section>

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
              {featured.map((residence) => (
                <ResidenceCard key={residence.slug} residence={residence} arsPerUsd={rate.arsPerUsd} />
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
          {audiences.map((a) => (
            <Card key={a.title} className="flex flex-col p-7">
              <h3 className="text-lg font-bold text-ink">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                {a.description}
              </p>
              <Link
                href={a.href}
                className="mt-5 text-sm font-semibold text-forest-700 hover:text-forest-700"
              >
                {a.cta} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="bg-forest-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange">
              Roadmap
            </p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Así seguimos construyendo EstuRed
            </h2>
            <p className="mt-3 text-forest-tint">
              No es una lista de promesas: cada etapa se construye sobre datos
              reales que ya estamos generando en la plataforma.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {upcoming.map((u) => (
              <div
                key={u.title}
                className="rounded-card border border-forest-600 bg-forest-600/40 p-6"
              >
                <p className="inline-flex rounded-full bg-forest-ink/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
                  {u.stage}
                </p>
                <h3 className="mt-3 font-bold">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-tint">
                  {u.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader eyebrow="Preguntas frecuentes" title="Dudas comunes" />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-card border border-sand-200 bg-surface p-5 open:shadow-card"
            >
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
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-mint">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
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
        </div>
      </section>
    </>
  );
}
