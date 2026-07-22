import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

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
    icon: "quiz",
  },
  {
    title: "Solicitudes ordenadas",
    description:
      "Recibís solicitudes completas, con el perfil del estudiante y sus preferencias. Decidís avanzar, rechazar o pedir más información.",
    icon: "inbox",
  },
  {
    title: "Condiciones negociables con reglas claras",
    description:
      "Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.",
    icon: "handshake",
  },
  {
    title: "Lista de espera automática",
    description:
      "Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.",
    icon: "hourglass_top",
  },
  {
    title: "Renovaciones sin fricción",
    description:
      "Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.",
    icon: "sync_alt",
  },
  {
    title: "Sello de Residencia Verificada",
    description:
      "La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.",
    icon: "verified",
  },
];

export default function ForResidencesPage() {
  return (
    <>
      <section className="bg-forest-ink text-white">
        <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex rounded-full bg-forest-600 px-3 py-1 text-sm font-semibold text-forest-tint">
              Para residencias estudiantiles
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Tu residencia llena, pero tu tiempo no debería estarlo.
            </h1>
            <p className="mt-5 text-lg text-forest-tint">
              EstuRed no reemplaza tu operación: la ordena. Menos consultas
              repetidas, solicitudes completas, lista de espera y renovaciones
              con un proceso claro — y un plan gratuito para empezar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/register/residence" size="lg" variant="secondary">
                Quiero sumar mi residencia
              </Button>
              <Button
                href="#como-funciona"
                variant="outline"
                size="lg"
                className="border-forest text-white hover:bg-forest-600"
              >
                Ver cómo funciona
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Beneficios — asimétrico: el primero se planta grande, el resto
          acompaña en una lista dividida, sin repetir 6 cards idénticas. */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Profesionalizá tu gestión sin cambiar tu forma de trabajar"
        />
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
          <Reveal className="flex flex-col justify-center rounded-card border-2 border-forest-tint bg-forest-tint/40 p-8">
            <Icon name={benefits[0].icon} className="text-4xl text-forest-700" />
            <h3 className="mt-6 font-display text-2xl font-bold text-ink">{benefits[0].title}</h3>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">{benefits[0].description}</p>
          </Reveal>
          <div className="grid gap-x-8 gap-y-0 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            {benefits.slice(1).map((b, i) => (
              <Reveal
                key={b.title}
                delay={((i % 5) + 1) as 1 | 2 | 3 | 4 | 5}
                className={`flex gap-3 py-5 sm:py-4 ${i < 2 ? "sm:border-b sm:border-line" : ""} ${i % 2 === 0 ? "sm:pr-4" : "sm:pl-4"}`}
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
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Planes"
            title="Empezá gratis, crecé cuando lo necesites"
            description="Dos modos pensados para acompañar distintos niveles de gestión."
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
                    <Icon name="check_circle" className="mt-0.5 shrink-0 text-base text-forest-700" /> {f}
                  </li>
                ))}
              </ul>
            </Card>
            </Reveal>
            <Reveal delay={1}>
            <Card interactive className="h-full border-forest p-8">
              <Badge tone="amber">Plan pago — gratis 1 año para pioneras</Badge>
              <h3 className="mt-3 text-2xl font-bold text-ink">
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
                    <Icon name="check_circle" className="mt-0.5 shrink-0 text-base text-orange-600" /> {f}
                  </li>
                ))}
              </ul>
            </Card>
            </Reveal>
          </div>
          <p className="mt-6 text-center text-sm text-ink-faint">
            Las residencias pioneras de la beta acceden a Gestión Operativa sin
            costo durante 1 año.
          </p>
        </div>
      </section>

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink">
            Sé una residencia pionera
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Estamos seleccionando entre 5 y 10 residencias de CABA para la
            primera etapa. Creá tu cuenta ahora — coordinamos la verificación
            presencial una vez que completes tu perfil.
          </p>
          <div className="mt-6">
            <Button href="/register/residence" size="lg">
              Quiero sumar mi residencia
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
