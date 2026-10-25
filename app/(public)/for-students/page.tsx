import type { Metadata } from "next";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";
import { RotatingBenefits, type RotatingBenefit } from "@/components/ui/RotatingBenefits";
import { StepsList } from "@/app/(public)/for-students/StepsList";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { FamilyHighlight } from "@/components/marketing/FamilyHighlight";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";
import { WhatYouPay } from "@/components/marketing/WhatYouPay";
import { WhenSomethingDiffers } from "@/components/marketing/WhenSomethingDiffers";

export const metadata: Metadata = {
  title: "Para estudiantes y familias",
  description:
    "Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva verificable.",
};

const benefits: RotatingBenefit[] = [
  {
    icon: "verified",
    title: "Residencias verificadas",
    summary:
      "Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial.",
    problem:
      "Elegir dónde vivir sin conocer el lugar es una de las decisiones más difíciles de mudarte a otra ciudad.",
    solution:
      "Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial, no una foto de stock ni una descripción exagerada. Revisamos cada espacio en persona: fotos auténticas, servicios reales y reglas claras. El sello Residencia Verificada no reemplaza que consultes las condiciones de tu estadía.",
    conclusion: "Elegís con información revisada en persona.",
  },
  {
    icon: "description",
    title: "Solicitudes registradas",
    summary:
      "Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.",
    problem:
      "Negociar condiciones por WhatsApp significa que después cuesta saber qué quedó acordado.",
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
      "Si tu familia está lejos, seguir cada paso de tu mudanza a la distancia es difícil — y una decisión así se toma mejor en compañía.",
    solution:
      "Un familiar vinculado puede proponerte opciones y seguir el proceso paso a paso. Vos siempre tenés la última palabra sobre tu solicitud.",
    conclusion: "Con compañía, y la decisión sigue siendo tuya.",
  },
  {
    icon: "receipt_long",
    title: "Comprobante de Reserva Confirmada",
    summary:
      "Cuando tu reserva se confirma, recibís un comprobante que cualquier persona puede verificar.",
    problem:
      "Pagar una matrícula o un depósito sin ningún papel te deja con dudas, a vos y a tu familia.",
    solution:
      "Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona, con los datos de tu reserva.",
    conclusion: "Un registro claro, no una promesa de palabra.",
  },
  {
    icon: "groups",
    title: "Comunidad visible",
    summary:
      "Descubrí la comunidad de cada residencia antes de mudarte: quiénes viven ahí, qué estudian y qué intereses comparten, según lo que cada residente elige mostrar.",
    problem:
      "Vas a convivir con gente que no elegiste, en un lugar que no conocés. Saber con quién vas a vivir ayuda a decidir con más tranquilidad.",
    solution:
      "Descubrí la comunidad de cada residencia antes de mudarte: quiénes viven ahí, qué estudian y qué intereses comparten, según lo que cada residente elige mostrar.",
    conclusion: "Elegís tu lugar sabiendo también con quién vas a compartirlo.",
  },
  {
    icon: "sell",
    title: "Precios claros",
    summary:
      "Tarifas en dólares con su equivalente referencial en pesos, actualizado a diario. Matrícula y depósito a la vista, y la política de ajustes publicada.",
    problem:
      "Los precios que cambian según a quién le preguntes, o que aparecen recién cuando ya avanzaste con una residencia, generan desconfianza.",
    solution:
      "Tarifas en dólares con su equivalente referencial en pesos, actualizado a diario. Matrícula y depósito a la vista, y la política de ajustes publicada.",
    conclusion: "Sabés qué vas a pagar y a quién antes de comprometerte.",
  },
];

const steps = [
  {
    text: "Creá tu cuenta, completá tu perfil y buscá residencias verificadas. Vos elegís qué mostrás; la residencia ve tu perfil cuando le enviás una solicitud.",
    detail: "Cuantos más datos completes y más opciones compares, más fácil vas a poder decidir con contexto cuando encuentres la residencia indicada.",
  },
  {
    text: "Enviás tu solicitud de reserva, gratis. Si ese tipo de habitación está completo, te sumás a su lista de espera.",
    detail: "Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.",
  },
  {
    text: "La residencia te responde. Puede confirmar tus condiciones o proponerte un único ajuste, que podés aceptar o rechazar.",
    detail: "Si te proponen un ajuste, la decisión final siempre es tuya — nadie confirma nada sin tu aprobación.",
  },
  {
    text: "Le pagás a la residencia lo acordado para reservar (por ejemplo, el primer mes o la matrícula) y la residencia confirma que lo recibió.",
    detail: "La residencia confirma la recepción del pago, así que ese paso también queda con registro.",
  },
  {
    text: "Pagás el fee EstuRed: el 5% de tu estadía inicial, sin contar el depósito. Ves el monto exacto antes de pagar, y lo podés pagar vos o el familiar que designes. Después, tu reserva queda confirmada y recibís tu Comprobante de Reserva Confirmada.",
    detail: "El fee se paga una vez que la residencia confirma que recibió tu pago. La factura de EstuRed sale a nombre de quien paga, y el comprobante tiene un código que cualquiera puede verificar.",
  },
];

const faqs = [
  {
    q: "¿Cuánto cuesta usar EstuRed?",
    a: "Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado y a EstuRed un fee del 5% sobre tu estadía inicial, sin contar el depósito. El monto exacto lo ves antes de pagar.",
  },
  {
    q: "¿EstuRed verifica a los estudiantes?",
    a: "No. EstuRed verifica a las residencias, no a las personas. Vos elegís qué mostrás en tu perfil, y cada residencia revisa las solicitudes que recibe antes de confirmar.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Podés abrir un caso de Soporte desde tu reserva. Revisamos la evidencia y, según el caso, puede corresponder la devolución del fee EstuRed. Más detalle en «Si algo no coincide con lo publicado».",
  },
];

export const dynamic = "force-dynamic";

export default async function ForStudentsPage() {
  const sessionUser = await getSessionUser();
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
              Elegí tu residencia en Buenos Aires con todo verificado y por escrito
            </h1>
            <p className="mt-5 text-lg text-ink-soft">
              Elegir dónde vivir es una de las decisiones más importantes de tu
              nueva etapa. EstuRed la hace clara: residencias verificadas,
              proceso registrado y un comprobante verificable de tu reserva.
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
              <ResidencePhoto
                src={heroPhoto}
                name={heroResidence?.name ?? "Residencia verificada"}
                zone={heroResidence?.zone}
                alt={heroResidence ? `Residentes en ${heroResidence.name}` : "Residencia verificada"}
                sizes="(max-width: 1024px) 90vw, 45vw"
                variant="hero"
                priority
              />
              {heroPhoto && <div className="absolute inset-0 bg-gradient-to-t from-forest-ink/60 via-transparent to-transparent" />}
              {heroResidence && (
                <div className={`absolute inset-x-0 p-5 ${heroPhoto ? "bottom-0" : "top-0"}`}>
                  <p className={`text-sm font-bold ${heroPhoto ? "text-white" : "text-ink"}`}>{heroResidence.name}</p>
                  <p className={`text-xs ${heroPhoto ? "text-white/80" : "text-ink-soft"}`}>{heroResidence.zone}, {heroResidence.city}</p>
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

      <FamilyHighlight />

      <section className="bg-surface border-y border-sand-200">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Paso a paso"
            title="Así funciona el proceso"
            description="Enviar una solicitud es gratis. La residencia revisa tu perfil y confirma si hay lugar."
          />
          <StepsList steps={steps} />
        </div>
      </section>

      <div className="border-b border-sand-200">
        <WhatYouPay />
      </div>

      <WhenSomethingDiffers />

      <StayChangeHighlight variant="students" studentCta={sessionUser?.roles.includes("student") ? "residency" : "register"} />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
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
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink">
            Empezá tu búsqueda con todo a la vista
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Buscá entre las residencias verificadas de CABA y enviá tu solicitud.
            Es gratis.
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
