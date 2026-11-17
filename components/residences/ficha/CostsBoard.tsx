import { Icon } from "@/components/ui/Icon";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { PaymentSteps } from "@/components/residences/ficha/PaymentSteps";
import { SealOnView } from "@/components/residences/ficha/SealOnView";
import type { PaidSeparately } from "@/lib/residences/fichaCosts";

/** Servicios a la vista en «Incluido en el precio»; el resto se resume en «y N más» con enlace a «Vivir acá», donde están todos. */
const MAX_INCLUDED = 8;

/**
 * Cuadro de costos del capítulo «Qué incluye y qué se paga aparte» (propuesta A, fase 4). Forma un rectángulo cerrado:
 * arriba, dos tarjetas de la MISMA altura («Incluido en el precio» y «Se paga aparte») y, abajo y a todo el ancho, la línea de
 * tiempo «Cómo y cuándo pagás». El hueco que dejaría la tarjeta izquierda lo ocupa el sello «Verificada», anclado al pie.
 *
 * `included`: los servicios que la residencia declaró incluidos en el precio (nunca se inventan; sin ninguno, la tarjeta lo dice).
 * `paid`: lo arma `buildPaidSeparately`. Todo monto en USD trae su referencia en ARS con `ExchangeRateNote`.
 */
export function CostsBoard({ included, paid, residenceName }: { included: string[]; paid: PaidSeparately; residenceName: string }) {
  const shown = included.slice(0, MAX_INCLUDED);
  const hidden = included.length - shown.length;
  return (
    <div className="grid gap-3.5 min-[700px]:grid-cols-2 min-[700px]:items-stretch">
      <section aria-labelledby="costs-included" className="flex flex-col rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
        <h3 id="costs-included" className="font-display text-xl font-bold text-ink">
          Incluido en el precio
        </h3>
        {included.length > 0 ? (
          <ul className="mt-3 grid gap-2.5">
            {shown.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-ink">
                <span aria-hidden="true" className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-forest-tint text-forest-700">
                  <Icon name="check" className="text-base" />
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
              </li>
            ))}
            {hidden > 0 && (
              <li className="pl-[34px] text-[15px] text-ink-soft">
                Y {hidden} {hidden === 1 ? "servicio más" : "servicios más"}.{" "}
                <a href="#vivir" className="font-bold text-forest-700 underline underline-offset-2">
                  Verlos en «Vivir acá»
                </a>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-ink-soft">
            {residenceName} todavía no detalló qué servicios incluye el precio. Podés consultarlo en las preguntas frecuentes.
          </p>
        )}
        <div className="mt-5 flex items-center gap-4 border-t-[1.5px] border-line pt-5 min-[700px]:mt-auto min-[700px]:pt-5">
          <SealOnView size={104} />
          <p className="min-w-0">
            <strong className="block font-display text-[17px] font-bold text-ink">Residencia verificada</strong>
            <span className="block text-[15px] leading-snug text-ink-soft">
              EstuRed la visitó en persona y chequeó que lo que ves sea real.
            </span>
          </p>
        </div>
      </section>

      <section aria-labelledby="costs-paid" className="flex flex-col rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
        <h3 id="costs-paid" className="font-display text-xl font-bold text-ink">
          Se paga aparte
        </h3>
        {paid.groups.map((group) => (
          <div key={group.key} className="mt-3">
            <p className="text-[13px] font-bold text-forest-700">{group.who}</p>
            <dl className="mt-1 divide-y-[1.5px] divide-line">
              {group.rows.map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="min-w-0">
                    <span className="block font-semibold text-ink">{row.label}</span>
                    <span className="block text-[14px] leading-snug text-ink-soft">{row.help}</span>
                  </dt>
                  <dd className="shrink-0 text-right">
                    <span className="block whitespace-nowrap font-display font-bold tabular-nums text-ink">{row.value}</span>
                    {row.valueNote && <span className="block text-[13px] text-ink-faint">{row.valueNote}</span>}
                    {row.ars && (
                      <span className="flex items-center justify-end whitespace-nowrap text-[13px] tabular-nums text-ink-faint">
                        {row.ars}
                        <ExchangeRateNote compact align="end" />
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {paid.hasArs && (
          <p className="mt-3">
            <ExchangeRateNote showNote />
          </p>
        )}
        {paid.footnote && <p className="mt-2 text-[14px] leading-snug text-ink-soft">{paid.footnote}</p>}
      </section>

      <section aria-labelledby="costs-steps" className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card min-[700px]:col-span-2 min-[700px]:px-6">
        <PaymentSteps headingId="costs-steps" />
      </section>
    </div>
  );
}
