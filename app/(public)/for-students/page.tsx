import type { Metadata } from "next";
import { StudentsHero } from "@/components/marketing/StudentsHero";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { STUDENT_BENEFITS } from "@/components/marketing/BenefitBento";
import { BenefitCompare } from "@/components/marketing/BenefitCompare";
import { CommunityPreview } from "@/components/marketing/CommunityPreview";
import { StepsList } from "@/app/(public)/for-students/StepsList";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { FamilyHighlight } from "@/components/marketing/FamilyHighlight";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";
import { GuidePicks } from "@/components/guides/GuidePicks";
import { WhatYouPay } from "@/components/marketing/WhatYouPay";

export const metadata: Metadata = {
  title: "Para estudiantes y familias",
  description:
    "Mudarse a CABA con más confianza: residencias verificadas, solicitudes registradas y comprobante de reserva verificable.",
};

const steps = [
  {
    icon: "search",
    title: "Creá tu cuenta y buscá",
    hook: "Filtrá y compará residencias con reglas y comunidad a la vista.",
    detail: [
      "Creá tu cuenta, completá tu perfil y buscá tu residencia.",
      "Completá tu perfil, usá los filtros y mirá reglas, disponibilidad y comunidad de cada residencia para decidir con más información.",
    ],
    shot: { src: "/landing/proceso-1-busqueda.webp", alt: "Ejemplo de la búsqueda de residencias con filtros", w: 2280, h: 1480 },
  },
  {
    icon: "edit_note",
    title: "Enviá tu solicitud",
    hook: "Gratis y registrada. Si no hay lugar, lista de espera automática.",
    detail: [
      "Enviá tu solicitud. Cuanto más completo tu perfil, mejor. Si ese tipo de habitación está completo, ponete en lista de espera y te avisamos automáticamente cuando haya disponibilidad.",
      "Tu solicitud queda registrada y no depende de conversaciones por WhatsApp que puedan perderse.",
    ],
    shot: { src: "/landing/proceso-2-solicitud.webp", alt: "Ejemplo del formulario de solicitud", w: 2240, h: 904 },
  },
  {
    icon: "mark_email_read",
    title: "La residencia te responde",
    hook: "Propuesta con valores finales, sin costos ocultos.",
    detail: [
      "Si la residencia acepta, te envía la propuesta definitiva y los valores finales para abonar, sin costos ocultos, todo claro y registrado.",
      "Si te proponen un ajuste, la decisión final siempre es tuya.",
    ],
    shot: { src: "/landing/proceso-3-respuesta.webp", alt: "Ejemplo de la propuesta de una residencia", w: 1248, h: 584 },
  },
  {
    icon: "apartment",
    title: "Le pagás a la residencia",
    hook: "Lo acordado para reservar; ella confirma que lo recibió.",
    detail: [
      "Le pagás a la residencia lo acordado para reservar (por ejemplo, el primer mes o la matrícula) y la residencia confirma que lo recibió.",
      "La residencia confirma la recepción del pago, así que ese paso también queda con registro.",
    ],
    shot: { src: "/landing/proceso-4-pago.webp", alt: "Ejemplo del paso de pago a la residencia", w: 1248, h: 820 },
  },
  {
    icon: "verified",
    title: "Confirmás y recibís tu comprobante",
    hook: "Fee de EstuRed del 5%, aparte. Ves el monto exacto antes de pagar.",
    detail: [
      "Confirmá tu reserva: abonás el fee de EstuRed (5% de tu estadía inicial) y obtenés tu Comprobante de Reserva Confirmada.",
      "Ves el monto exacto antes de pagar, y lo podés pagar vos o el familiar que designes. La factura sale a nombre de quien paga y el comprobante tiene un código que cualquiera puede verificar.",
    ],
    shot: { src: "/landing/proceso-5-comprobante.webp", alt: "Ejemplo del Comprobante de Reserva Confirmada", w: 1312, h: 960 },
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

      {/* Beneficios — comparativo «Lo que suele pasar → Con EstuRed» (tabla real) */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Lo que cambia cuando buscás con EstuRed"
          description="Conocé los requisitos y beneficios de cada residencia sin moverte de tu casa."
        />
        <BenefitCompare items={STUDENT_BENEFITS} label="Lo que suele pasar y lo que cambia con EstuRed" />
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
        <GuidePicks keys={["05"]} variant="link" label="¿Sos familiar? Leé" className="mt-8 text-center" />
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
