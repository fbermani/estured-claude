import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { MoneyFlow } from "@/components/marketing/MoneyFlow";

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
    label: "Pago 1 · A la residencia",
    amount: "Lo acordado",
    tone: "residence",
    text: "Por ejemplo, el primer mes o la matrícula, y después las mensualidades. Le pagás directamente a la residencia, que confirma que lo recibió. EstuRed no cobra ese dinero.",
  },
  {
    icon: "payments",
    label: "Pago 2 · Aparte, a EstuRed",
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

/** Ejemplo numérico ilustrativo (marcado «Ejemplo» en la UI): alquiler con promo + matrícula neta = base del fee. */
const EX = { rent: 480, tuition: 120, deposit: 300 };
const EX_BASE = EX.rent + EX.tuition;
const EX_FEE = EX_BASE * 0.05;
const EX_TO_RESIDENCE = EX.rent + EX.tuition + EX.deposit;

function ExampleBreakdown() {
  const pct = (n: number) => `${(n / EX_TO_RESIDENCE) * 100}%`;
  return (
    <div className="mt-8 rounded-[28px] border border-line bg-paper p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Ejemplo</span>
        <p className="font-display text-base font-bold text-ink">Cómo se ven los dos pagos, con cifras de ejemplo</p>
      </div>
      <div className="mt-5 grid gap-5">
        <div>
          <p className="flex items-baseline justify-between gap-3 text-sm font-bold text-ink">
            <span className="text-forest-700">Pago 1 · A la residencia</span>
            <span className="font-display text-lg">USD {EX_TO_RESIDENCE}</span>
          </p>
          <div className="mt-2 flex h-9 overflow-hidden rounded-field text-[11px] font-bold sm:text-xs" role="img" aria-label={`A la residencia: alquiler con promoción USD ${EX.rent}, matrícula neta USD ${EX.tuition} y depósito USD ${EX.deposit}`}>
            <span style={{ width: pct(EX.rent) }} className="flex items-center justify-center bg-forest text-white">Alquiler {EX.rent}</span>
            <span style={{ width: pct(EX.tuition) }} className="flex items-center justify-center overflow-hidden bg-forest-600 text-white">Matríc. {EX.tuition}</span>
            <span style={{ width: pct(EX.deposit) }} className="flex items-center justify-center bg-sand-200 text-ink-soft">Depósito {EX.deposit}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">Alquiler (con promo) y matrícula (ya con su descuento) cuentan para el fee. El depósito, nunca.</p>
        </div>
        <div>
          <p className="flex items-baseline justify-between gap-3 text-sm font-bold text-ink">
            <span className="text-amber-soft-700">Pago 2 · Aparte, a EstuRed</span>
            <span className="font-display text-lg">USD {EX_FEE}</span>
          </p>
          <div className="mt-2 h-9 rounded-field bg-amber-soft-100" role="img" aria-label={`Fee de EstuRed: USD ${EX_FEE}`}>
            <div style={{ width: pct(EX_FEE) }} className="h-full min-w-2 rounded-field bg-amber-soft-400" />
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            5% de USD {EX_BASE} (alquiler con promo + matrícula neta). Es un pago separado: no sale de lo que le pagás a la residencia.
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-faint">Cifras ilustrativas. En tu solicitud ves el monto exacto antes de pagar.</p>
    </div>
  );
}

/** Bloque «Qué pagás y a quién» (INVENTARIO_COPY §7.1). El ejemplo numérico es ilustrativo y va marcado «Ejemplo». */
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

  if (variant === "residence") return <MoneyFlow />;

  return (
    <section id="que-pagas" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Costos"
        title="Qué pagás y a quién"
        description="Cuatro cosas distintas, cada una con su momento. Tocá cada una para ver el detalle."
      />
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {studentItems.map((item, i) => (
          <Reveal key={item.label} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
            <details className={`group rounded-card border transition-shadow open:shadow-card hover:shadow-card ${toneClass[item.tone]}`}>
              <summary className="flex cursor-pointer list-none flex-col gap-1 rounded-card p-5 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between">
                  <Icon name={item.icon} className="text-3xl text-forest-700" />
                  <Icon name="expand_more" className="text-2xl text-forest-700 transition-transform duration-300 group-open:rotate-180" />
                </span>
                <span className="mt-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">{item.label}</span>
                <span className="font-display text-xl font-bold text-ink">{item.amount}</span>
                <span className="mt-1 text-xs font-semibold text-forest-700">
                  <span className="group-open:hidden">Ver detalle</span>
                  <span className="hidden group-open:inline">Cerrar</span>
                </span>
              </summary>
              <p className="benefit-fade-in border-t border-black/5 px-5 pb-5 pt-3 text-sm leading-relaxed text-ink-soft">{item.text}</p>
            </details>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <ExampleBreakdown />
      </Reveal>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Los precios se publican en dólares, con su equivalente referencial en pesos actualizado a
        diario. <ExchangeRateNote />
      </p>
    </section>
  );
}
