import { WhatYouPay } from "@/components/marketing/WhatYouPay";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SwipeStack } from "@/components/ui/SwipeStack";
import { CommunityPreview } from "@/components/marketing/CommunityPreview";
import { HoverFeatureList } from "@/components/ui/HoverFeatureList";
import { VERIFIED_FEATURES, PREMIUM_FEATURES } from "@/lib/residences/planFeatures";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";


export const metadata: Metadata = {
  title: "Para residencias",
  description:
    "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.",
};

const pains = [
  {
    icon: "diversity_3",
    title: "Afinidad de convivencia antes de aceptar",
    quote: "«Una mala convivencia y se te vacía media habitación.»",
    text: "Ves intereses y hábitos de cada estudiante antes de decir que sí. Elegís pensando en quién ya vive en esa habitación.",
  },
  {
    icon: "fact_check",
    title: "Reservas y pagos con registro",
    quote: "«La seña quedó en un chat y nadie se acuerda qué se acordó.»",
    text: "Lo acordado y lo cobrado quedan por escrito, para vos y para el estudiante. Sin discusiones de memoria.",
  },
  {
    icon: "quiz",
    title: "Menos consultas repetidas",
    quote: "«Respondo precio y reglas veinte veces por semana.»",
    text: "Tu ficha responde lo de siempre. Te escriben quienes ya leyeron todo.",
  },
  {
    icon: "event_repeat",
    title: "Renovaciones y lista de espera juntas",
    quote: "«Me entero tarde de quién renueva y quién se va.»",
    text: "Sabés quién sigue y a quién avisarle cuando se libera una plaza, en un mismo lugar.",
  },
];

const faqs = [
  {
    q: "¿Qué implica sumar mi residencia a EstuRed?",
    a: "Dejás una solicitud de alta y el equipo te contacta. Coordinan la visita y recién ahí recibís tu cuenta.",
    more: "Primero conocemos tu residencia y a su responsable. Nada se publica antes de eso.",
  },
  {
    q: "¿Qué es gratis y qué está bonificado?",
    a: "El Plan Gratuito (Perfil Verificado) no tiene costo. El Plan Premium (Gestión Operativa) está bonificado el primer año para Residencias fundadoras.",
    more: "Todavía no hay precio publicado para el Plan Premium.",
  },
  {
    q: "¿Quién define precios, condiciones y acepta reservas?",
    a: "Vos. La residencia define sus precios y condiciones, y decide qué solicitudes acepta.",
    more: "EstuRed no fija tarifas ni decide por vos.",
  },
  {
    q: "¿Quién cobra matrícula, seña o depósito?",
    a: "Vos, directo al estudiante y según lo que acordaron. EstuRed no interviene en ese cobro.",
    more: "EstuRed cobra aparte, al estudiante, un fee del 5% sobre la estadía inicial. Nunca sobre el depósito ni se descuenta de lo que te pagan a vos.",
  },
  {
    q: "¿Cómo es la verificación?",
    a: "Revisamos responsable, ubicación y fotos antes de publicar tu residencia.",
    more: "Solo las residencias verificadas aparecen en el catálogo.",
  },
  {
    q: "¿Cómo empiezo y gestiono solicitudes y disponibilidad?",
    a: "Empezás con la solicitud de alta; después recibís tu cuenta. Desde el panel ves las solicitudes y informás tu disponibilidad.",
    more: "La disponibilidad la informás vos y puede cambiar. Si necesitás ayuda, escribile a Soporte.",
  },
];

export default function ForResidencesPage() {
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
      <section className="relative overflow-hidden bg-forest-ink text-white">
        {/* Resplandor decorativo — le da profundidad al fondo oscuro en vez de un verde plano */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-orange/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-forest-600/40 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <p className="mb-4 inline-flex rounded-full bg-forest-600 px-3 py-1 text-sm font-semibold text-forest-tint">
              Para residencias estudiantiles
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Menos mensajes, más residencia
            </h1>
            <p className="mt-5 text-lg text-forest-tint">
              EstuRed no reemplaza tu operación: la ordena. Menos consultas
              repetidas, solicitudes completas, lista de espera y renovaciones
              con un proceso claro. Perfil Verificado gratuito.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/register/residence" size="lg" variant="secondary">
                Solicitar sumar mi residencia
              </Button>
              <Button
                href="#como-funciona"
                variant="outline"
                size="lg"
                className="border-forest bg-transparent text-white hover:bg-forest-600"
              >
                Ver cómo funciona
              </Button>
            </div>
          </Reveal>

          {/* Composición visual — un vistazo ilustrativo al panel real
              (solicitud entrante + métrica), no una foto de stock: ancla
              la promesa "ordena tu operación" en algo concreto. */}
          <Reveal delay={2} className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="rounded-card bg-paper p-5 text-ink shadow-float">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-forest-700">
                <span className="h-1.5 w-1.5 rounded-full bg-forest-600" aria-hidden />
                Solicitud nueva
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-tint text-sm font-bold text-forest-700">
                  MJ
                </span>
                <div>
                  <p className="font-bold text-ink">María José R.</p>
                  <p className="text-xs text-ink-faint">Habitación Doble · Desde marzo</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="flex-1 rounded-full bg-forest px-4 py-2 text-center text-xs font-bold text-white">Establecer contacto</span>
                <span className="flex-1 rounded-full border-[1.5px] border-line-2 px-4 py-2 text-center text-xs font-bold text-ink-soft">Ver perfil</span>
              </div>
            </div>
            <div className="absolute -right-4 -top-5 hidden max-w-[190px] rotate-2 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-sm font-extrabold leading-snug text-forest-700">
                <Icon name="quiz" className="text-lg" />
                Preguntas frecuentes en tu ficha
              </p>
              <p className="mt-1 text-xs text-ink-faint">Menos consultas repetidas por WhatsApp</p>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden -rotate-1 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="hourglass_top" className="text-lg text-orange-700" />
                Lista de espera ordenada
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Beneficios: dolores y cómo se resuelven; en mobile, mazo con swipe */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Herramientas para el día a día de tu residencia"
          description="Lo que hoy resolvés entre chats, planillas y memoria, en un solo lugar."
        />
        <SwipeStack label="Beneficios para residencias" className="grid gap-4 md:grid-cols-2 md:gap-5">
          {pains.map((p) => (
            <article
              key={p.title}
              className="grid grid-cols-[44px_1fr] gap-3 rounded-card border border-line bg-paper p-6 shadow-card transition-all duration-300 ease-bounce md:hover:-translate-y-[3px] md:hover:shadow-card-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-field bg-petrol-50 text-petrol-600">
                <Icon name={p.icon} className="text-2xl" />
              </span>
              <div className="grid content-start gap-2">
                <h3 className="text-[19px] text-ink">{p.title}</h3>
                <p className="text-[13.5px] italic text-ink-faint">{p.quote}</p>
                <p className="text-[15px] text-ink-soft">{p.text}</p>
              </div>
            </article>
          ))}
        </SwipeStack>
      </section>

      <StayChangeHighlight variant="residences" />

      <CommunityPreview variant="residences" />

      <section className="bg-surface border-y border-sand-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Planes"
            title="Dos planes, uno para empezar"
            description="Perfil Verificado es gratuito. Plan Premium, bonificado el primer año para Residencias fundadoras."
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal>
            <Card interactive className="h-full p-8">
              <Badge tone="sage">Gratuito</Badge>
              <h3 className="mt-3 text-2xl font-bold text-ink">
                Perfil Verificado
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Tu residencia en el catálogo, con el sello de verificación
                de EstuRed y gestión de solicitudes.
              </p>
              <HoverFeatureList items={VERIFIED_FEATURES} icon="check_circle" tone="forest" className="mt-6 text-sm" />
            </Card>
            </Reveal>
            <Reveal delay={1}>
            <Card interactive className="h-full border-forest p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">Plan Premium</Badge>
                <Badge tone="sage">Bonificado el 1er año</Badge>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-ink">
                Plan Premium
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Todo lo del Perfil Verificado, más la Gestión Operativa: habitaciones,
                plazas, residentes, comunidad y renovaciones.
              </p>
              <HoverFeatureList items={PREMIUM_FEATURES} icon="check_circle" tone="orange" className="mt-6 text-sm" />
            </Card>
            </Reveal>
          </div>
          <p className="mt-6 text-center text-xs text-ink-faint">
            Plan Premium bonificado el primer año para Residencias fundadoras.
          </p>
        </div>
      </section>

      <div className="border-b border-sand-200">
        <WhatYouPay variant="residence" />
      </div>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader eyebrow="Preguntas frecuentes" title="Dudas de las residencias" />
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
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
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

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink">
            Sumate como Residencia fundadora
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Estamos sumando las primeras residencias de CABA: las Residencias
            fundadoras. Dejanos tus datos y el equipo de EstuRed te contacta para
            conocer tu residencia y coordinar la visita.
          </p>
          <div className="mt-6">
            <Button href="/register/residence" size="lg">
              Solicitar sumar mi residencia
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
