import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * «Qué cobra EstuRed» para residencias. Dos pagos SEPARADOS, y los dos los hace el estudiante (o su familiar):
 * 1) a la residencia, directo (alquiler, matrícula y depósito); 2) el fee de EstuRed, aparte, calculado sobre lo que
 * paga el estudiante (alquiler con promoción + matrícula neta + meses vacíos confirmados), nunca sobre el depósito ni
 * descontado a la residencia. Cada pago es una tarjeta con su propio «Estudiante o familiar → destino», así en mobile
 * (tarjetas apiladas) el fee no parece salir de la residencia. Server Component, sin cifras inventadas.
 */

function Payer() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cream-2 px-4 py-3 font-bold text-ink">
      <Icon name="school" className="text-2xl" />
      Estudiante o familiar
    </div>
  );
}

function Arrow({ tone, title, text }: { tone: "forest" | "amber"; title: string; text: string }) {
  const color = tone === "forest" ? "border-forest text-forest" : "border-amber-soft-400 text-amber-soft-700";
  return (
    <div className="grid grid-cols-[24px_1fr] gap-3 pl-3.5">
      <span aria-hidden className={`relative mx-auto flex min-h-14 w-0 justify-center border-l-2 border-dashed ${color}`}>
        <Icon name="arrow_downward" className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-paper text-xl" />
      </span>
      <p className="pb-2 text-[13.5px] leading-snug text-ink-soft">
        <b className="block text-sm text-ink">{title}</b>
        {text}
      </p>
    </div>
  );
}

export function MoneyFlow() {
  return (
    <section id="que-cobra-estured" aria-labelledby="que-cobra-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Costos"
        title="Qué cobra EstuRed"
        description="Lo que paga el estudiante por tu residencia te llega a vos, completo. El fee de EstuRed lo paga el estudiante, aparte."
      />
      <h3 id="que-cobra-title" className="sr-only">
        A quién le paga cada cosa el estudiante
      </h3>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-10">
        <Reveal>
          <div role="group" aria-label="Diagrama: el estudiante hace dos pagos separados" className="grid gap-4 rounded-[30px] border border-line bg-paper p-5 shadow-card sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Pago 1 */}
              <div className="grid content-start gap-3 rounded-2xl border border-line p-4">
                <p className="text-xs font-bold text-forest-700">Pago 1: a tu residencia</p>
                <Payer />
                <Arrow tone="forest" title="Alquiler, matrícula y depósito" text="Paga directo a vos, en tu cuenta y en tus términos." />
                <div className="flex items-center gap-3 rounded-2xl bg-forest-tint px-4 py-3 font-bold text-forest-700">
                  <Icon name="home" className="text-2xl" />
                  Tu residencia
                </div>
              </div>
              {/* Pago 2 */}
              <div className="grid content-start gap-3 rounded-2xl border border-amber-soft-300 bg-amber-soft-100/40 p-4">
                <p className="text-xs font-bold text-amber-soft-700">Pago 2: aparte, a EstuRed</p>
                <Payer />
                <Arrow tone="amber" title="Fee de EstuRed (5%)" text="También lo paga el estudiante, después de que confirmás su pago. No sale de lo que te pagan a vos." />
                <div className="flex items-center gap-3 rounded-2xl bg-amber-soft-100 px-4 py-3 font-bold text-amber-soft-700">
                  <Icon name="hub" className="text-2xl" />
                  EstuRed
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-cream px-4 py-3.5 text-[13.5px] text-ink-soft">
              <p className="font-bold text-ink">El fee se calcula sobre lo que paga el estudiante:</p>
              <ul className="mt-2 grid gap-1.5">
                {["Alquiler, con la promoción aplicada", "Matrícula, ya con su descuento", "Meses vacíos confirmados"].map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <Icon name="check_circle" className="mt-px text-lg text-forest" />
                    {t}
                  </li>
                ))}
                <li className="flex items-start gap-1.5">
                  <Icon name="block" className="mt-px text-lg text-red-600" />
                  <span>
                    <b className="text-ink">No se descuenta</b> de lo que cobrás.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="grid gap-3">
            <div className="grid grid-cols-[auto_1fr] items-center gap-3.5 rounded-field border border-line bg-paper px-[18px] py-4">
              <span className="min-w-[72px] font-display text-[28px] font-bold text-forest-700">0%</span>
              <p className="text-[14.5px] text-ink-soft">
                <b className="block text-ink">Descuento sobre tu tarifa</b>
                No retenemos ni descontamos nada de lo que te pagan.
              </p>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3.5 rounded-field border border-line bg-paper px-[18px] py-4">
              <span className="min-w-[72px] font-display text-[28px] font-bold text-forest-700">USD 0</span>
              <p className="text-[14.5px] text-ink-soft">
                <b className="block text-ink">Publicar y gestionar, hoy</b>
                Perfil Verificado (gratuito) y Plan Premium (bonificado el primer año para Residencias fundadoras).
              </p>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3.5 rounded-field border border-line bg-paper px-[18px] py-4">
              <span className="flex min-w-[72px] text-forest-700">
                <Icon name="account_balance" className="text-[30px]" />
              </span>
              <p className="text-[14.5px] text-ink-soft">
                <b className="block text-ink">Cobro directo</b>
                EstuRed no toca el dinero de tus reservas: vos confirmás que lo recibiste.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
