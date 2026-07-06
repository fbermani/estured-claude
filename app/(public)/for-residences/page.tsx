import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Para residencias",
  description:
    "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.",
};

const benefits = [
  {
    title: "Menos consultas repetidas",
    description:
      "Tu perfil verificado responde las preguntas de siempre: precios, servicios, reglas y disponibilidad. Una FAQ asistida responde por vos.",
  },
  {
    title: "Solicitudes ordenadas",
    description:
      "Recibís solicitudes completas, con el perfil del estudiante y sus preferencias. Decidís avanzar, rechazar o pedir más información.",
  },
  {
    title: "Condiciones negociables con reglas claras",
    description:
      "Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.",
  },
  {
    title: "Lista de espera automática",
    description:
      "Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.",
  },
  {
    title: "Renovaciones sin fricción",
    description:
      "Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.",
  },
  {
    title: "Sello de Residencia Verificada",
    description:
      "La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.",
  },
];

export default function ForResidencesPage() {
  return (
    <>
      <section className="bg-petrol-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex rounded-full bg-petrol-700 px-3 py-1 text-sm font-semibold text-petrol-100">
              Para residencias estudiantiles
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Tu residencia llena, pero tu tiempo no debería estarlo.
            </h1>
            <p className="mt-5 text-lg text-petrol-100">
              EstuRed no reemplaza tu operación: la ordena. Menos consultas
              repetidas, solicitudes completas, lista de espera y renovaciones
              con un proceso claro — y un plan gratuito para empezar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/waitlist" size="lg" variant="secondary">
                Quiero sumar mi residencia
              </Button>
              <Button
                href="#como-funciona"
                variant="outline"
                size="lg"
                className="border-petrol-400 text-white hover:bg-petrol-700"
              >
                Ver cómo funciona
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Profesionalizá tu gestión sin cambiar tu forma de trabajar"
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
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Planes"
            title="Empezá gratis, crecé cuando lo necesites"
            description="Dos modos pensados para acompañar distintos niveles de gestión."
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-8">
              <Badge tone="sage">Gratuito</Badge>
              <h3 className="mt-3 text-2xl font-bold text-petrol-800">
                Perfil Verificado
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Tu residencia en el catálogo, con el sello de verificación
                presencial y gestión de solicitudes.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-soft">
                {[
                  "Perfil público verificado con fotos, servicios y reglas",
                  "Disponibilidad informada por tipo de habitación",
                  "Solicitudes de reserva registradas",
                  "Lista de espera",
                  "FAQ asistida",
                  "Renovaciones",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-sage-600">✓</span> {f}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-petrol-300 p-8">
              <Badge tone="amber">Plan pago — gratis 1 año para pioneras</Badge>
              <h3 className="mt-3 text-2xl font-bold text-petrol-800">
                Gestión Operativa
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Todo lo del Perfil Verificado, más gestión en tiempo real de tus
                habitaciones y plazas.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-soft">
                {[
                  "Disponibilidad real por plaza — \"Disponibilidad asegurada\"",
                  "Gestión de habitaciones, plazas y residentes",
                  "Solicitudes por plaza específica",
                  "Métricas de gestión y respuesta",
                  "Prioridad de visibilidad en el catálogo",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-amber-soft-500">✓</span> {f}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="mt-6 text-center text-sm text-ink-faint">
            Las residencias pioneras de la beta acceden a Gestión Operativa sin
            costo durante 1 año.
          </p>
        </div>
      </section>

      <section className="bg-sage-100">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-petrol-800">
            Sé una residencia pionera
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Estamos seleccionando entre 5 y 10 residencias de CABA para la
            primera etapa. Dejanos tus datos y te contactamos para coordinar la
            verificación.
          </p>
          <div className="mt-6">
            <Button href="/waitlist" size="lg">
              Quiero sumar mi residencia
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
