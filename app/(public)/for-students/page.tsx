import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/pageMeta";
import { StudentsHero } from "@/components/marketing/StudentsHero";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { STUDENT_BENEFITS } from "@/components/marketing/BenefitBento";
import { BenefitCompare } from "@/components/marketing/BenefitCompare";
import { CommunityPreview } from "@/components/marketing/CommunityPreview";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { FamilyHighlight } from "@/components/marketing/FamilyHighlight";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { WhatYouPay } from "@/components/marketing/WhatYouPay";

export const metadata: Metadata = pageMetadata({
  title: "Para estudiantes y familias",
  description:
    "Residencias en CABA visitadas en persona. Mirá comunidad, reglamento y costos antes de enviar tu solicitud de reserva.",
  path: "/for-students",
});

const faqs = [
  {
    q: "¿Qué requisitos piden las residencias?",
    a: "Los ves en la ficha y en el reglamento de cada residencia, antes de enviar tu solicitud de reserva.",
  },
  {
    q: "¿Qué pasa si no hay lugar?",
    a: "Podés anotarte en la lista de espera de esa habitación. La residencia puede avisarte si se libera un lugar.",
  },
  {
    q: "¿EstuRed verifica a los estudiantes?",
    a: "No. Verificamos residencias, no personas. Vos elegís qué mostrás en tu perfil.",
  },
  {
    q: "¿Qué pasa si algo no coincide con lo publicado?",
    a: "Abrís un caso de Soporte desde tu reserva. Revisamos lo que pasó, hablamos con la residencia y, si hace falta, te acompañamos para encontrar otra opción. Aplica a diferencias importantes y comprobables; lo que pagaste a la residencia se resuelve con ella, según sus condiciones.",
  },
];

export const dynamic = "force-dynamic";

export default async function ForStudentsPage() {
  const sessionUser = await getSessionUser();
  const catalog = await getCatalogResidences();

  return (
    <>
      <StudentsHero residences={catalog} />

      {/* Beneficios — comparativo «A ciegas → Con EstuRed» (tabla real) */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader eyebrow="Beneficios" title="Lo que ves antes de elegir" />
        <BenefitCompare items={STUDENT_BENEFITS} label="A ciegas y con EstuRed" />
      </section>

      <CommunityPreview variant="students" />

      <FamilyHighlight />

      <div className="border-b border-sand-200">
        <WhatYouPay />
      </div>

      <StayChangeHighlight variant="students" studentCta={sessionUser?.roles.includes("student") ? "residency" : "register"} />

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
      <section id="preguntas-frecuentes" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
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
        <GuidePicks keys={["05"]} variant="link" label="¿Sos familiar? Leé" className="mt-8 text-center" />
      </section>

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl md:text-5xl">
            Empezá tu búsqueda con todo a la vista
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Buscá entre las residencias verificadas de CABA. Enviar tu solicitud
            de reserva es gratis.
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
