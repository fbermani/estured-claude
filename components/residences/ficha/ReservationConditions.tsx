import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import type { FichaConditionsInput } from "@/lib/residences/fichaConditions";
import { applicableConditions, type ApplicableCondition } from "@/lib/residences/conditionCards";
import { EMPTY_MONTH_IDEA, EMPTY_MONTH_RULES, emptyMonthExample } from "@/lib/residences/emptyMonthCopy";

function EmptyMonthHelp({ percent }: { percent: number }) {
  return (
    <span className="mt-0.5 block space-y-1.5 text-[14px] leading-snug text-ink-soft">
      <span className="block">{EMPTY_MONTH_IDEA}</span>
      <span className="block font-semibold text-ink">{emptyMonthExample(percent)}</span>
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
          Cómo se calcula
        </summary>
        <span className="block pb-1">{EMPTY_MONTH_RULES}</span>
      </details>
      <a href="#preguntas" className="inline-block font-bold text-forest-700 underline underline-offset-2">
        Ver más en las preguntas frecuentes
      </a>
    </span>
  );
}

/**
 * Condiciones de la reserva, debajo de «Habitaciones y precio» (revisión del dueño en staging: antes quedaban listadas todas, también las
 * que no aplicaban). Ahora se ven SOLO las que aplican a la residencia (`applicableConditions`: estadía mínima, pago para reservar y, si
 * existen, matrícula, depósito, ajuste de tarifa y mes vacío); lo que no aplica no se dibuja. Mismo formato que «Se paga aparte» del
 * mockup: título destacado con su aclaración a la izquierda y el valor a la derecha, con su referencia en ARS (`ExchangeRateNote`).
 * Sin promesas de disponibilidad; un dato no cargado nunca se inventa.
 */
export function ReservationConditions({
  conditions,
  arsPerUsd,
  headingId = "h-condiciones",
}: {
  conditions: FichaConditionsInput;
  arsPerUsd: number;
  headingId?: string;
}) {
  const rows: ApplicableCondition[] = applicableConditions(conditions);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
      <h3 id={headingId} className="font-display text-xl font-bold text-ink">
        Condiciones de la reserva
      </h3>
      <dl className="mt-3 divide-y-[1.5px] divide-line">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-4 py-3 first:pt-2 last:pb-0">
            <dt className="min-w-0">
              <span className="block text-[17px] font-bold leading-snug text-ink">{row.title}</span>
              {row.key === "empty_month" && row.emptyPercent != null ? (
                <EmptyMonthHelp percent={row.emptyPercent} />
              ) : (
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">{row.help}</span>
              )}
            </dt>
            <dd className="shrink-0 text-right">
              <span className="block whitespace-nowrap font-display text-lg font-bold tabular-nums text-ink">{row.value}</span>
              {row.valueNote && <span className="block text-[13px] text-ink-soft">{row.valueNote}</span>}
              {row.arsFromUsd != null && (
                <span className="flex items-center justify-end whitespace-nowrap text-[13px] tabular-nums text-ink-soft">
                  ≈ {formatArs(usdToArsRounded(row.arsFromUsd, arsPerUsd))}
                  <ExchangeRateNote compact align="end" />
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
