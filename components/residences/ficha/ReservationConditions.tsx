import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { ConditionCard } from "@/components/residences/ficha/ConditionCard";
import { Icon } from "@/components/ui/Icon";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import type { FichaConditionsInput } from "@/lib/residences/fichaConditions";
import { buildConditionRows, visibleConditionCards, type ConditionRow } from "@/lib/residences/conditionCards";
import { EMPTY_MONTH_CARD_LINE, EMPTY_MONTH_IDEA, EMPTY_MONTH_RULES, emptyMonthExample } from "@/lib/residences/emptyMonthCopy";

const ICONS: Record<ConditionRow["key"], string> = {
  initial_payment: "payments",
  enrollment: "badge",
  deposit: "savings",
  adjustment: "trending_up",
  empty_month: "hourglass_top",
  documents: "description",
};

function FaqLink() {
  return (
    <a href="#preguntas" className="font-bold text-forest-700 underline underline-offset-2">
      Ver más en las preguntas frecuentes
    </a>
  );
}

/**
 * Condiciones de admisión (DR53, reemplaza «seis tarjetas fijas» de DR30 §4): las TARJETAS muestran solo lo que
 * cobra algo («Para reservar» siempre; Matrícula, Depósito y Mes vacío solo si la residencia los cobra). Las seis
 * condiciones, incluidas las que no cobran o no tienen dato, quedan tras un único «Ver condiciones completas».
 * Si un dato no está cargado se dice («No cobra», «A coordinar»), nunca se inventa.
 */
export function ReservationConditions({
  conditions,
  arsPerUsd,
  onlyDetails = false,
}: {
  conditions: FichaConditionsInput;
  arsPerUsd: number;
  /** Solo el expander «Ver condiciones completas» (sin las tarjetas): el cuadro de costos del capítulo ya dice lo que se cobra. */
  onlyDetails?: boolean;
}) {
  const rows = buildConditionRows(conditions);
  const cards = visibleConditionCards(rows);
  const ars = (row: ConditionRow) =>
    row.arsFromUsd != null ? (
      <>
        ≈ {formatArs(usdToArsRounded(row.arsFromUsd, arsPerUsd))}
        <ExchangeRateNote />
      </>
    ) : undefined;

  return (
    <div>
      {!onlyDetails && (
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        {cards.map((row) =>
          row.key === "empty_month" ? (
            <ConditionCard
              key={row.key}
              icon={ICONS[row.key]}
              title={row.title}
              value={row.value}
              note={EMPTY_MONTH_CARD_LINE}
              detail={
                <>
                  {EMPTY_MONTH_IDEA} <FaqLink />.
                </>
              }
            />
          ) : (
            <ConditionCard
              key={row.key}
              icon={ICONS[row.key]}
              title={row.title}
              value={row.value}
              note={row.valueNote ?? ars(row)}
              detail={
                <>
                  {row.help}
                  {row.valueNote && row.arsFromUsd != null && <span className="mt-1 block text-ink-faint">{ars(row)}</span>}
                </>
              }
            />
          ),
        )}
      </ul>
      )}

      <details className={`group rounded-card border-[1.5px] border-line bg-paper ${onlyDetails ? "" : "mt-3"}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-card px-3.5 py-2.5 text-sm font-bold text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
          Ver condiciones completas
          <Icon name="expand_more" className="text-xl transition-transform group-open:rotate-180" />
        </summary>
        <dl className="divide-y divide-line border-t border-line px-3.5">
          {rows.map((row) => (
            <div key={row.key} className="py-3">
              <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Icon name={ICONS[row.key]} className="text-lg text-forest-700" />
                {row.title}
              </dt>
              <dd className="mt-1 text-sm text-ink-soft">
                <span className="font-display font-bold tabular-nums text-ink">{row.value}</span>
                {row.valueNote && <span className="text-ink-faint"> · {row.valueNote}</span>}
                {row.arsFromUsd != null && <span className="ml-1 text-xs text-ink-faint">{ars(row)}</span>}
                {row.key === "empty_month" ? (
                  row.emptyPercent != null ? (
                    <span className="mt-1 block space-y-1.5 text-xs leading-relaxed">
                      <span className="block">{EMPTY_MONTH_IDEA}</span>
                      <span className="block">{EMPTY_MONTH_RULES}</span>
                      <span className="block font-semibold text-ink">{emptyMonthExample(row.emptyPercent)}</span>
                      <span className="block">
                        <FaqLink />.
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs leading-relaxed">
                      Esta residencia no cobra por el tiempo en que la plaza queda libre antes de tu ingreso.
                    </span>
                  )
                ) : (
                  <span className="mt-1 block text-xs leading-relaxed">{row.help}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
