import { WhatYouPay } from "@/components/marketing/WhatYouPay";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { RotatingBenefits, type RotatingBenefit } from "@/components/ui/RotatingBenefits";
import { HoverFeatureList } from "@/components/ui/HoverFeatureList";
import { StayChangeHighlight } from "@/components/marketing/StayChangeHighlight";

const freePlanFeatures = [
  {
    label: "Perfil público verificado con fotos, servicios y reglas",
    detail: "Es lo primero que ve un estudiante al buscar — reduce las consultas de gente que no tenía la información básica.",
  },
  {
    label: "Disponibilidad informada por tipo de habitación",
    detail: "Mostrás cupo por tipo de habitación sin necesidad de gestionar cada cama individualmente.",
  },
  {
    label: "Solicitudes de reserva registradas",
    detail: "Cada solicitud queda con fecha y estado, sin depender de tu memoria o de un chat.",
  },
  {
    label: "Lista de espera",
    detail: "Cuando un tipo de habitación está completo, los interesados se anotan en tu lista. Si se libera un lugar, les avisás desde tu panel.",
  },
  {
    label: "Preguntas frecuentes",
    detail: "Cargá hasta 5 preguntas y respuestas en tu ficha para que los interesados resuelvan dudas básicas antes de escribirte.",
  },
  {
    label: "Renovaciones",
    detail: "Gestioná renovaciones de tus residentes actuales sin tener que perseguir confirmaciones.",
  },
];

const paidPlanFeatures = [
  {
    label: "Habitaciones y plazas",
    detail: "Cargás tus habitaciones y camas, y ves la ocupación de cada una.",
  },
  {
    label: "Residentes",
    detail: "Registrás altas, salidas y notas, y respondés los avisos de «Quiero cambiar».",
  },
  {
    label: "Comunidad visible",
    detail: "Los estudiantes conocen a quienes viven en tu residencia, según lo que cada residente elige mostrar.",
  },
  {
    label: "Elección de plaza",
    detail: "El estudiante puede indicar una plaza libre al solicitar; la residencia confirma.",
  },
];

export const metadata: Metadata = {
  title: "Para residencias",
  description:
    "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes.",
};

const benefits: RotatingBenefit[] = [
  {
    icon: "quiz",
    title: "Menos consultas repetidas",
    summary:
      "Tu perfil verificado responde las preguntas de siempre: precios, servicios, reglas y disponibilidad. Sumá preguntas frecuentes en tu ficha para resolver el resto.",
    problem:
      "Responder las mismas preguntas de precio, servicios y disponibilidad, una y otra vez por WhatsApp, te come el tiempo que deberías usar en gestionar tu residencia.",
    solution:
      "Tu perfil verificado responde las preguntas de siempre: precios, servicios, reglas y disponibilidad. Sumá preguntas frecuentes en tu ficha para resolver el resto.",
    conclusion: "Menos tiempo respondiendo lo mismo, más tiempo gestionando.",
  },
  {
    icon: "inbox",
    title: "Solicitudes ordenadas",
    summary:
      "Conectá con estudiantes afines a tu casa y cuidá el clima de convivencia. Recibís solicitudes completas, con el perfil que cada estudiante elige compartir; decidís si avanzás, proponés un ajuste o rechazás.",
    problem:
      "Recibir consultas sueltas por distintos canales, sin el contexto del estudiante, hace difícil evaluar quién realmente encaja.",
    solution:
      "Conectá con estudiantes afines a tu casa y cuidá el clima de convivencia. Recibís solicitudes completas, con el perfil que cada estudiante elige compartir; decidís si avanzás, proponés un ajuste o rechazás.",
    conclusion: "Toda la información que necesitás, en un solo lugar.",
  },
  {
    icon: "handshake",
    title: "Condiciones negociables con reglas claras",
    summary:
      "Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.",
    problem:
      "Negociar condiciones por chat, sin un proceso claro, genera confusión sobre qué quedó acordado y qué no.",
    solution:
      "Antes de confirmar, podés proponer un ajuste de condiciones por solicitud. Todo registrado, sin idas y vueltas informales.",
    conclusion: "Un acuerdo claro, con historial, no un ida y vuelta que se pierde.",
  },
  {
    icon: "hourglass_top",
    title: "Lista de espera ordenada",
    summary:
      "Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.",
    problem:
      "Cuando estás completa, seguir anotando manualmente a quién avisarle si se libera un lugar es trabajo extra que nadie tiene tiempo de hacer bien.",
    solution:
      "Si estás completa, los interesados se anotan solos. Cuando se libera una plaza, avisás con un clic.",
    conclusion: "Sabés a quién avisarle cuando se libera un lugar.",
  },
  {
    icon: "sync_alt",
    title: "Renovaciones sin fricción",
    summary:
      "Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.",
    problem:
      "Perseguir a tus residentes actuales para confirmar si renuevan es una tarea manual, repetitiva y fácil de postergar.",
    solution:
      "Gestioná renovaciones de tus residentes actuales con ofertas y estados claros, sin perseguir confirmaciones.",
    conclusion: "Renovaciones con un proceso claro, sin perseguir a nadie.",
  },
  {
    icon: "verified",
    title: "Sello de Residencia Verificada",
    summary:
      "La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.",
    problem:
      "Compitiendo con publicaciones informales, es difícil demostrarle a un estudiante que tu residencia es seria y real, sin pedirle que confíe a ciegas.",
    solution:
      "La verificación presencial te diferencia de las publicaciones informales y les da tranquilidad a estudiantes y familias.",
    conclusion: "Un sello que genera confianza antes de la primera consulta.",
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
              Menos mensajes, más residencia
            </h1>
            <p className="mt-5 text-lg text-forest-tint">
              EstuRed no reemplaza tu operación: la ordena. Menos consultas
              repetidas, solicitudes completas, lista de espera y renovaciones
              con un proceso claro. Hoy, sin costo para las residencias verificadas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/register/residence" size="lg" variant="secondary">
                Sumar mi residencia
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
                <span className="flex-1 rounded-full bg-forest px-4 py-2 text-center text-xs font-bold text-white">Establecer contacto</span>
                <span className="flex-1 rounded-full border-[1.5px] border-line-2 px-4 py-2 text-center text-xs font-bold text-ink-soft">Ver perfil</span>
              </div>
            </div>
            <div className="absolute -right-4 -top-5 hidden max-w-[190px] rotate-2 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-sm font-extrabold leading-snug text-forest-700">
                <Icon name="quiz" className="text-lg" />
                Preguntas frecuentes en tu ficha
              </p>
              <p className="mt-1 text-xs text-ink-faint">Menos consultas repetidas por WhatsApp</p>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden -rotate-1 rounded-card bg-surface p-3.5 text-ink shadow-float ring-1 ring-sand-200 transition-transform duration-300 ease-bounce hover:-translate-y-1 hover:rotate-0 sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="hourglass_top" className="text-lg text-orange-700" />
                Lista de espera ordenada
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Beneficios — interactivo, rota solo y se puede explorar con clicks */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Beneficios"
          title="Profesionalizá tu gestión sin cambiar tu forma de trabajar"
        />
        <RotatingBenefits items={benefits} />
      </section>

      <StayChangeHighlight variant="residences" />

      <section className="bg-surface border-y border-sand-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeader
            eyebrow="Planes"
            title="Hoy, todo sin costo"
            description="Mientras armamos la red, todas las herramientas son gratis para las residencias verificadas."
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
              <HoverFeatureList items={freePlanFeatures} icon="check_circle" tone="forest" className="mt-6 text-sm" />
            </Card>
            </Reveal>
            <Reveal delay={1}>
            <Card interactive className="h-full border-forest p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">Gestión Operativa</Badge>
                <Badge tone="sage">Incluido hoy</Badge>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-ink">
                Plan Premium bonificado el primer año para Residencias fundadoras
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Todo lo del Perfil Verificado, más la gestión de tus habitaciones,
                plazas y residentes.
              </p>
              <HoverFeatureList items={paidPlanFeatures} icon="check_circle" tone="orange" className="mt-6 text-sm" />
            </Card>
            </Reveal>
          </div>
          <p className="mt-6 text-center text-xs text-ink-faint">
            Si te sumás como Residencia fundadora, tu primer año de Plan Premium
            está bonificado. El plan todavía no tiene precio: te lo vamos a
            informar con anticipación y nadie paga nada sin aceptarlo antes.
          </p>
        </div>
      </section>

      <div className="border-b border-sand-200">
        <WhatYouPay variant="residence" />
      </div>

      <section className="bg-mint">
        <Reveal className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-ink">
            Sumate como Residencia fundadora
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            Estamos sumando las primeras residencias de CABA: las Residencias
            fundadoras. Creá tu cuenta y, cuando completes tu perfil, coordinamos
            la visita de verificación.
          </p>
          <div className="mt-6">
            <Button href="/register/residence" size="lg">
              Sumar mi residencia
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
