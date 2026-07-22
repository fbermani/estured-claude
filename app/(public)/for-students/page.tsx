import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";
import { getCatalogResidences } from "@/lib/residences/catalog";

export const metadata: Metadata = {
  title: "Para estudiantes y familias",
  description:
    "Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva respaldado.",
};

const benefits = [
  {
    title: "Residencias verificadas",
    description:
      "Cada residencia del catálogo fue visitada presencialmente por el equipo de EstuRed. Lo que ves publicado es real.",
    icon: "verified",
  },
  {
    title: "Solicitudes registradas",
    description:
      "Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.",
    icon: "description",
  },
  {
    title: "Tu familia puede acompañarte",
    description:
      "Un familiar vinculado puede proponerte opciones y seguir el proceso. Vos siempre tenés la última palabra sobre tu solicitud.",
    icon: "diversity_1",
  },
  {
    title: "Comprobante de Reserva Confirmada",
    description:
      "Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona. Respaldo real para vos y tu familia.",
    icon: "receipt_long",
  },
  {
    title: "Comunidad visible",
    description:
      "Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.",
    icon: "groups",
  },
  {
    title: "Precios claros",
    description:
      "Tarifas en USD con equivalente referencial en pesos al dólar blue del día, matrícula y depósito explícitos, políticas de ajuste publicadas.",
    icon: "sell",
  },
];

const steps = [
  "Creá tu cuenta y completá tu perfil básico: de dónde venís, qué buscás, tu presupuesto y tu fecha estimada de mudanza.",
  "Buscá y compará residencias verificadas. Guardá tus favoritas.",
  "Enviá tu solicitud de reserva. Si la residencia está completa, sumate a su lista de espera.",
  "La residencia te responde. Puede confirmar tus condiciones o proponerte un único ajuste, que podés aceptar o rechazar.",
  "Pagás a la residencia el concepto acordado (matrícula, seña o depósito) y la residencia confirma la recepción.",
  "Tu reserva queda confirmada en EstuRed y recibís tu Comprobante de Reserva Confirmada.",
];

export const dynamic = "force-dynamic";

export default async function ForStudentsPage() {
  const catalog = await getCatalogResidences();
  const heroResidence = catalog[0] ?? null;
  const heroPhoto = heroResidence?.photos[0] ?? null;

  return (
    <>
      <section className="overflow-hidden bg-sand-100">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <p className="mb-4 inline-flex rounded-full bg-mint px-3 py-1 text-sm font-semibold text-forest-700">
              Para estudiantes y familias
            </p>
            <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">
              Mudarte a CABA con más confianza
            </h1>
            <p className="mt-5 text-lg text-ink-soft">
              Elegir dónde vivir es una de las decisiones más importantes de tu
              nueva etapa. EstuRed la hace clara: residencias verificadas,
              proceso registrado y un comprobante que respalda tu reserva.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/search" size="lg">
                Buscar residencia en CABA
              </Button>
              <Button href="/register" variant="outline" size="lg">
                Crear cuenta de estudiante
              </Button>
            </div>
          </Reveal>

          {/* Composición visual — foto real de una residencia verificada,
              con señales de confianza flotantes (mismo lenguaje que el
              hero de home, pero como foto editorial, no card de catálogo). */}
          <Reveal delay={2} className="relative mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-none">
            <div className="relative h-full w-full overflow-hidden rounded-card bg-sand-200 shadow-float">
              {heroPhoto ? (
                <Image
                  src={heroPhoto}
                  alt={heroResidence ? `Residentes en ${heroResidence.name}` : "Residencia verificada"}
                  fill
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Icon name="apartment" className="text-6xl text-ink-faint" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-forest-ink/60 via-transparent to-transparent" />
              {heroResidence && (
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-sm font-bold text-white">{heroResidence.name}</p>
                  <p className="text-xs text-white/80">{heroResidence.zone}, {heroResidence.city}</p>
                </div>
              )}
            </div>
            <div className="absolute -right-4 -top-5 hidden max-w-[210px] rotate-2 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="verified" className="text-lg text-forest-700" />
                Verificada presencialmente
              </p>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden -rotate-1 rounded-card bg-surface p-3.5 shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="diversity_3" className="text-lg text-orange-700" />
                Comunidad visible antes de mudarte
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Beneficios — asimétrico: el primero (verificación presencial, la
          base de la confianza) se planta grande; el resto acompaña en una
          lista dividida, sin repetir 6 cards idénticas. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Lo que cambia cuando buscás con EstuRed"
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
          <Reveal className="flex flex-col justify-center rounded-card border-2 border-forest-tint bg-forest-tint/40 p-8">
            <Icon name={benefits[0].icon} className="text-4xl text-forest-700" />
            <h3 className="mt-6 font-display text-2xl font-bold text-ink">{benefits[0].title}</h3>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">{benefits[0].description}</p>
          </Reveal>
          <div className="flex flex-col divide-y divide-line rounded-card border-[1.5px] border-line bg-paper p-2 shadow-card sm:p-3">
            {benefits.slice(1).map((b, i) => (
              <Reveal
                key={b.title}
                delay={((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}
                className="flex gap-3 rounded-field p-4 transition-colors hover:bg-cream-2"
              >
                <Icon name={b.icon} className="mt-0.5 shrink-0 text-xl text-forest-700" />
                <div>
                  <h3 className="font-bold text-ink">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface border-y border-sand-200">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Paso a paso"
            title="Así funciona el proceso"
            description="La disponibilidad publicada es informativa: toda reserva está sujeta a la confirmación de la residencia."
          />
          <ol className="relative space-y-4 border-l-2 border-dashed border-line pl-6">
            {steps.map((step, i) => (
              <Reveal key={i} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
                <li className="relative flex gap-4">
                  <span className="absolute -left-[34px] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest font-display text-sm font-bold text-white ring-4 ring-surface">
                    {i + 1}
                  </span>
                  <p className="text-sm text-ink-soft sm:text-base">{step}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink">
            Empezá tu búsqueda con respaldo
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Sumate a la lista de espera y te avisamos cuando el catálogo de tu
            zona esté activo.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/search" size="lg">
              Buscar residencia
            </Button>
            <Button href="/register/student" variant="outline" size="lg">
              Crear cuenta
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
