import type { Metadata } from "next";
import { StudentsHero } from "@/components/marketing/StudentsHero";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { BenefitBento, STUDENT_BENEFITS } from "@/components/marketing/BenefitBento";
import { CommunityPreview } from "@/components/marketing/CommunityPreview";
import { StepsList } from "@/app/(public)/for-students/StepsList";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { FamilyHighlight } from "@/components/marketing/FamilyHighlight";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";
import { WhatYouPay } from "@/components/marketing/WhatYouPay";

export const metadata: Metadata = {
  title: "Para estudiantes y familias",
  description:
    "Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva verificable.",
};

const steps = [
  {
    text: "Creá tu cuenta, completá tu perfil y buscá tu residencia.",
    detail: "Completá tu perfil, usá los filtros y mirá reglas, disponibilidad y comunidad de cada residencia para decidir con más información.",
  },
  {
    text: "Enviá tu solicitud. Cuanto más completo tu perfil, mejor. Si ese tipo de habitación está completo, ponete en lista de espera y te avisamos automáticamente cuando haya disponibilidad.",
    detail: "Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.",
  },
  {
    text: "Si la residencia acepta, te envía la propuesta definitiva y los valores finales para abonar, sin costos ocultos, todo claro y registrado.",
    detail: "Si te proponen un ajuste, la decisión final siempre es tuya.",
  },
  {
    text: "Le pagás a la residencia lo acordado para reservar (por ejemplo, el primer mes o la matrícula) y la residencia confirma que lo recibió.",
    detail: "La residencia confirma la recepción del pago, así que ese paso también queda con registro.",
  },
  {
    text: "Confirmá tu reserva: abonás el fee de EstuRed (5% de tu estadía inicial, sin contar el depósito) y obtenés tu Comprobante de Reserva Confirmada.",
    detail: "Ves el monto exacto antes de pagar, y lo podés pagar vos o el familiar que designes. La factura sale a nombre de quien paga y el comprobante tiene un código que cualquiera puede verificar.",
  },
];

const faqs = [
  {
    q: "¿Cuánto cuesta usar EstuRed?",
    a: "Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado y a EstuRed un fee del 5% sobre tu estadía inicial, sin contar el depósito. El monto exacto lo ves antes de pagar.",
  },
  {
    q: "¿Qué requisitos piden las residencias?",
    a: "Los requisitos de ingreso los ves en la ficha y en el reglamento de cada residencia, antes de enviar tu solicitud.",
  },
  {
    q: "¿EstuRed verifica a los estudiantes?",
    a: "No. EstuRed verifica a las residencias, no a las personas. Vos elegís qué mostrás en tu perfil, y cada residencia revisa las solicitudes que recibe antes de confirmar.",
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

      {/* Beneficios — bento; en mobile, mazo con swipe */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Lo que cambia cuando buscás con EstuRed"
          description="Conocé los requisitos y beneficios de cada residencia sin moverte de tu casa."
        />
        <BenefitBento items={STUDENT_BENEFITS} label="Beneficios para estudiantes" />
      </section>

      <CommunityPreview variant="students" />

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

      <StayChangeHighlight variant="students" studentCta={sessionUser?.roles.includes("student") ? "residency" : "register"} />

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
