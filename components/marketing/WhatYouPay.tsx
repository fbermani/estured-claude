import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";

const studentItems = [
  {
    icon: "edit_note",
    label: "Enviar una solicitud",
    amount: "Gratis",
    text: "No pagás nada por solicitar ni por sumarte a una lista de espera.",
  },
  {
    icon: "apartment",
    label: "A la residencia",
    amount: "Lo acordado para reservar",
    text: "Por ejemplo, el primer mes o la matrícula, y después las mensualidades. Le pagás directamente a la residencia, que confirma que lo recibió. EstuRed no cobra ese dinero.",
  },
  {
    icon: "payments",
    label: "A EstuRed",
    amount: "Fee del 5%",
    text: "Sobre el total de tu estadía inicial, sin contar el depósito. Se paga una sola vez, después de que la residencia confirma tu pago, y lo podés pagar vos o el familiar que designes. Ves el monto exacto antes de pagar y recibís la factura de EstuRed.",
  },
  {
    icon: "receipt_long",
    label: "No es un pago",
    amount: "Comprobante de Reserva Confirmada",
    text: "Lo emite EstuRed cuando tu reserva se confirma, con un código que cualquier persona puede verificar.",
  },
];

const residenceLines = [
  "Cobro directo: el estudiante te paga a vos, sin comisión sobre tu tarifa. EstuRed cobra su fee aparte al estudiante y no toca lo que te paga.",
  "Hoy, publicar y gestionar tu residencia no tiene costo.",
];

/** Bloque «Qué pagás y a quién» (INVENTARIO_COPY §7.1). Sin cifras de ejemplo. */
export function WhatYouPay({ variant = "student" }: { variant?: "student" | "residence" | "short" }) {
  if (variant === "short") {
    return (
      <section id="que-pagas-resumen" className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
        <SectionHeader eyebrow="Costos" title="Qué pagás y a quién" />
        <p className="text-base leading-relaxed text-ink-soft">
          Enviar una solicitud es gratis. A la residencia le pagás directamente lo acordado y a EstuRed un fee del 5% de tu estadía
          inicial, sin contar el depósito: el monto exacto lo ves antes de pagar.
        </p>
        <Link
          href="/for-students#que-pagas"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 transition-transform duration-200 ease-bounce hover:translate-x-1"
        >
          Ver el detalle de costos <Icon name="arrow_forward" className="text-base" />
        </Link>
      </section>
    );
  }

  if (variant === "residence") {
    return (
      <section id="que-cobra-estured" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeader eyebrow="Costos" title="Qué cobra EstuRed" />
        <Card className="space-y-3 p-7">
          {residenceLines.map((line) => (
            <p key={line} className="text-sm leading-relaxed text-ink-soft">
              {line}
            </p>
          ))}
        </Card>
      </section>
    );
  }

  return (
    <section id="que-pagas" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Costos"
        title="Qué pagás y a quién"
        description="Cuatro cosas distintas, cada una con su momento."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {studentItems.map((item, i) => (
          <Reveal key={item.label} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
            <Card className="flex h-full flex-col p-6">
              <Icon name={item.icon} className="text-3xl text-forest-700" />
              <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                {item.label}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">{item.amount}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.text}</p>
            </Card>
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
