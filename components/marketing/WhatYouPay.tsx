import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { MoneyFlow } from "@/components/marketing/MoneyFlow";
import { PayCard } from "@/components/marketing/PayCard";

const studentItems = [
  {
    icon: "edit_note",
    label: "Al enviar tu solicitud de reserva",
    amount: "Nada",
    tone: "free",
    text: "Buscar, ver perfiles y anotarte en lista de espera tampoco tiene costo.",
  },
  {
    icon: "apartment",
    label: "Si te aceptan",
    amount: "La reserva",
    tone: "residence",
    text: "Le pagás a la residencia lo acordado, como el primer mes o la matrícula.",
  },
  {
    icon: "payments",
    label: "Cuando la residencia confirma tu pago",
    amount: "5% a EstuRed",
    tone: "fee",
    text: "Sobre tu estadía inicial. Lo pagás vos o el familiar que designes. Al validarlo, tu reserva queda confirmada.",
  },
  {
    icon: "calendar_month",
    label: "Durante tu estadía",
    amount: "Mensualidades",
    tone: "residence",
    text: "Se las pagás a la residencia, según sus condiciones.",
  },
] as const;

const toneClass = {
  free: "border-sand-200 bg-surface",
  residence: "border-forest/30 bg-forest-tint/60",
  fee: "border-amber-soft-300 bg-amber-soft-100/40",
} as const;

/** Estudiantes: «Qué pagás y cuándo» (DR68). Residencias: diagrama de costos (`MoneyFlow`). */
export function WhatYouPay({ variant = "student" }: { variant?: "student" | "residence" }) {
  if (variant === "residence") return <MoneyFlow />;

  return (
    <section id="que-pagas" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Costos"
        title="Qué pagás y cuándo"
        description="Sabés qué pagás ahora y qué después."
      />
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {studentItems.map((item, i) => (
          <Reveal key={item.label} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
            <PayCard icon={item.icon} label={item.label} amount={item.amount} text={item.text} toneClass={toneClass[item.tone]} />
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Los precios están en dólares. El pago de la reserva y el fee EstuRed quedan fijos en pesos cuando
        enviás tu solicitud de reserva. <ExchangeRateNote />
      </p>
      <p className="mt-4 text-center">
        <Link
          href="/#el-proceso"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest-700 transition-transform duration-200 ease-out-fresh hover:translate-x-1"
        >
          Ver los 4 pasos <Icon name="arrow_forward" className="text-base" />
        </Link>
      </p>
    </section>
  );
}
