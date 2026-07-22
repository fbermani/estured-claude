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
                <span className="flex-1 rounded-full bg-forest px-4 py-2 text-center text-xs font-bold text-white">Aceptar</span>
                <span className="flex-1 rounded-full border-[1.5px] border-line-2 px-4 py-2 text-center text-xs font-bold text-ink-soft">Ver perfil</span>
              </div>
            </div>
            <div className="absolute -right-4 -top-5 hidden max-w-[190px] rotate-2 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="text-2xl font-extrabold text-forest-700">–70%</p>
              <p className="text-xs text-ink-faint">menos consultas repetidas por WhatsApp</p>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden -rotate-1 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="hourglass_top" className="text-lg text-orange-700" />
                Lista de espera automática
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Beneficios — asimétrico: el primero se planta grande, el resto
          acompaña en una lista contenida (tarjeta con borde), sin repetir
          6 cards idénticas ni dejar huecos en la grilla. */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Profesionalizá tu gestión sin cambiar tu forma de trabajar"
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
