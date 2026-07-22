import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";
import { RotatingBenefits, type RotatingBenefit } from "@/components/ui/RotatingBenefits";
import { getCatalogResidences } from "@/lib/residences/catalog";

export const metadata: Metadata = {
  title: "Para estudiantes y familias",
  description:
    "Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva respaldado.",
};

const benefits: RotatingBenefit[] = [
  {
    icon: "verified",
    title: "Residencias verificadas",
    summary:
      "Cada residencia del catálogo fue visitada presencialmente por el equipo de EstuRed. Lo que ves publicado es real.",
    problem:
      "Elegir dónde vivir a distancia, sin conocer el lugar, es de las decisiones más riesgosas de mudarte a otra ciudad.",
    solution:
      "Cada residencia del catálogo fue visitada presencialmente por el equipo de EstuRed. Lo que ves publicado es real, no una foto de stock ni una descripción exagerada.",
    conclusion: "Elegís con información real, no con fe.",
  },
  {
    icon: "description",
    title: "Solicitudes registradas",
    summary:
      "Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.",
    problem:
      "Negociar condiciones por WhatsApp significa que todo depende de la memoria y la buena fe de la otra parte.",
    solution:
      "Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.",
    conclusion: "Un historial claro de todo lo que se acordó.",
  },
  {
    icon: "diversity_1",
    title: "Tu familia puede acompañarte",
    summary:
      "Un familiar vinculado puede proponerte opciones y seguir el proceso. Vos siempre tenés la última palabra sobre tu solicitud.",
    problem:
      "Si tu familia está lejos, seguir cada paso de tu mudanza a la distancia es difícil — y vos tampoco querés decidir algo tan importante solo/a.",
    solution:
      "Un familiar vinculado puede proponerte opciones y seguir el proceso paso a paso. Vos siempre tenés la última palabra sobre tu solicitud.",
    conclusion: "Acompañado/a, sin perder el control de tu decisión.",
  },
  {
    icon: "receipt_long",
    title: "Comprobante de Reserva Confirmada",
    summary:
      "Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona. Respaldo real para vos y tu familia.",
    problem:
      "Pagar una matrícula o depósito sin ningún papel que lo respalde deja a vos y a tu familia sin nada concreto si algo sale mal.",
    solution:
      "Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona, con los datos de tu reserva.",
    conclusion: "Respaldo real para vos y tu familia, no una promesa verbal.",
  },
  {
    icon: "groups",
    title: "Comunidad visible",
    summary:
      "Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.",
    problem:
      "Vas a convivir con gente que no elegiste, en un lugar que no conocés. No saber con quién vas a vivir genera mucha incertidumbre.",
    solution:
      "Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.",
    conclusion: "Elegís tu lugar sabiendo también con quién vas a compartirlo.",
  },
  {
    icon: "sell",
    title: "Precios claros",
    summary:
      "Tarifas en USD con equivalente referencial en pesos al dólar blue del día, matrícula y depósito explícitos, políticas de ajuste publicadas.",
    problem:
      "Los precios que cambian según a quién le preguntes, o que aparecen recién cuando ya avanzaste con una residencia, generan desconfianza.",
    solution:
      "Tarifas en USD con equivalente referencial en pesos al dólar blue del día, matrícula y depósito explícitos, políticas de ajuste publicadas.",
    conclusion: "Sabés cuánto vas a pagar antes de comprometerte.",
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

      {/* Beneficios — interactivo, rota solo y se puede explorar con clicks */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Lo que cambia cuando buscás con EstuRed"
        />
        <RotatingBenefits items={benefits} />
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
