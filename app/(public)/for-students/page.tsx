import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
  },
  {
    title: "Solicitudes registradas",
    description:
      "Tu solicitud, las respuestas y cualquier ajuste de condiciones quedan registrados en la plataforma. Nada se pierde en un chat.",
  },
  {
    title: "Tu familia puede acompañarte",
    description:
      "Un familiar vinculado puede proponerte opciones y seguir el proceso. Vos siempre tenés la última palabra sobre tu solicitud.",
  },
  {
    title: "Comprobante de Reserva Confirmada",
    description:
      "Cuando tu reserva se confirma, recibís un comprobante verificable por cualquier persona. Respaldo real para vos y tu familia.",
  },
  {
    title: "Comunidad visible",
    description:
      "Conocé cómo es la convivencia antes de decidir: quiénes viven en la residencia, según lo que cada residente elige compartir.",
  },
  {
    title: "Precios claros",
    description:
      "Tarifas en USD con equivalente referencial en pesos al dólar blue del día, matrícula y depósito explícitos, políticas de ajuste publicadas.",
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

export default function ForStudentsPage() {
  return (
    <>
      <section className="bg-sand-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex rounded-full bg-sage-100 px-3 py-1 text-sm font-semibold text-sage-800">
              Para estudiantes y familias
            </p>
            <h1 className="text-4xl font-extrabold text-petrol-800 sm:text-5xl">
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Lo que cambia cuando buscás con EstuRed"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <Card key={b.title} className="p-6">
              <h3 className="font-bold text-petrol-800">{b.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{b.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-surface border-y border-sand-200">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Paso a paso"
            title="Así funciona el proceso"
            description="La disponibilidad publicada es informativa: toda reserva está sujeta a la confirmación de la residencia."
          />
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol-600 font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm text-ink-soft sm:text-base">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-sage-100">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-petrol-800">
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
            <Button href="/waitlist" variant="outline" size="lg">
              Sumarme a la lista de espera
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
