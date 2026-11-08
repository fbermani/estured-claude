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
    label: "Enviar una solicitud",
    amount: "Gratis",
    tone: "free",
    text: "Buscar, conocer perfiles, anotarte en lista de espera y enviar solicitudes no tiene costo.",
  },
  {
    icon: "apartment",
    label: "Pago 1: a la residencia",
    amount: "Lo acordado",
    tone: "residence",
    text: "Por ejemplo, el primer mes o la matrícula, y después las mensualidades. Le pagás directamente a la residencia, que confirma que lo recibió. EstuRed no cobra ese dinero.",
  },
  {
    icon: "payments",
    label: "Pago 2: aparte, a EstuRed",
    amount: "Fee del 5%",
    tone: "fee",
    text: "Verás todos los montos antes de enviar tu solicitud. Solo abonás por nuestro servicio una vez que la residencia confirma tu pago, y lo podés pagar vos o el familiar que designes.",
  },
  {
    icon: "receipt_long",
    label: "Tu comprobante",
    amount: "Reserva confirmada",
    tone: "free",
    text: "Abonado el fee, obtenés tu Comprobante de Reserva Confirmada y tu reserva queda confirmada. Tiene un código que cualquiera puede verificar.",
  },
] as const;

const toneClass = {
  free: "border-sand-200 bg-surface",
  residence: "border-forest/30 bg-forest-tint/60",
  fee: "border-amber-soft-300 bg-amber-soft-100/40",
} as const;

/** Bloque «Qué pagás y a quién» (INVENTARIO_COPY §7.1). */
export function WhatYouPay({ variant = "student" }: { variant?: "student" | "residence" | "short" }) {
  if (variant === "short") {
    return (
      <section id="que-pagas-resumen" className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
        <SectionHeader eyebrow="Costos" title="Qué pagás y a quién" />
        <p className="text-base leading-relaxed text-ink-soft">
          Enviar una solicitud es gratis. A la residencia le pagás directamente lo acordado y a EstuRed un fee del 5% de tu estadía
          inicial: el monto exacto lo ves antes de pagar.
        </p>
        <Link
          href="/for-students#que-pagas"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 transition-transform duration-200 ease-out-fresh hover:translate-x-1"
        >
          Ver el detalle de costos <Icon name="arrow_forward" className="text-base" />
        </Link>
      </section>
    );
  }

  if (variant === "residence") return <MoneyFlow />;

  return (
    <section id="que-pagas" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Costos"
        title="Qué pagás y a quién"
        description="Cuatro cosas distintas, cada una con su momento. Pasá el mouse o tocá cada una para ver el detalle."
      />
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {studentItems.map((item, i) => (
          <Reveal key={item.label} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
            <PayCard icon={item.icon} label={item.label} amount={item.amount} text={item.text} toneClass={toneClass[item.tone]} />
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Los precios se publican en dólares, con su equivalente referencial en pesos actualizado a
        diario. <ExchangeRateNote />
      </p>
    </section>
  );
}
