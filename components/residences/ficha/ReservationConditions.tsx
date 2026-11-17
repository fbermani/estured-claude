import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { Icon } from "@/components/ui/Icon";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import { buildConditionItems, type FichaConditionsInput } from "@/lib/residences/fichaConditions";
import { buildConditionRows, type ConditionRow } from "@/lib/residences/conditionCards";
import { EMPTY_MONTH_IDEA, EMPTY_MONTH_RULES, emptyMonthExample } from "@/lib/residences/emptyMonthCopy";

const ICONS: Record<ConditionRow["key"] | "minimum_stay", string> = {
  minimum_stay: "event_available",
  initial_payment: "payments",
  enrollment: "badge",
  deposit: "savings",
  adjustment: "trending_up",
  empty_month: "hourglass_top",
  documents: "description",
};

type ListRow = {
  key: ConditionRow["key"] | "minimum_stay";
  title: string;
  value: string;
  valueNote?: string;
  help: string;
  arsFromUsd?: number | null;
  emptyPercent?: number;
};

function FaqLink() {
  return (
    <a href="#preguntas" className="font-bold text-forest-700 underline underline-offset-2">
      Ver más en las preguntas frecuentes
    </a>
  );
}

/**
 * Condiciones de la reserva como LISTA escaneable, debajo de «Habitaciones y precio» (revisión del dueño en staging: el desplegable «Ver
 * condiciones completas» ya no existe). Son los mismos datos de siempre, en el mismo orden: estadía mínima, pago para reservar, matrícula,
 * depósito, ajuste de tarifa, mes vacío y documentos. Un dato no cargado se dice («No cobra», «A coordinar con la residencia»), nunca
 * se inventa; los montos en USD traen su referencia en ARS (`ExchangeRateNote`). Sin promesas de disponibilidad.
 * Cada fila es un par título / valor con su aclaración: en escritorio dos columnas (título a la izquierda), en móvil apilado.
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
  const stay = buildConditionItems(conditions).find((i) => i.key === "minimum_stay");
  const rows: ListRow[] = [
    ...(stay ? [{ key: "minimum_stay" as const, title: stay.label, value: stay.value, help: stay.help }] : []),
    ...buildConditionRows(conditions),
  ];
  const ars = (row: ListRow) =>
    row.arsFromUsd != null ? (
      <>
        ≈ {formatArs(usdToArsRounded(row.arsFromUsd, arsPerUsd))}
        <ExchangeRateNote compact />
      </>
    ) : null;

  return (
    <section aria-labelledby={headingId} className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
      <h3 id={headingId} className="font-display text-xl font-bold text-ink">
        Condiciones de la reserva
      </h3>
      <dl className="mt-3 divide-y-[1.5px] divide-line">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0 min-[640px]:grid-cols-[13rem_minmax(0,1fr)]">
            <dt className="flex items-center gap-2 font-bold text-ink">
              <Icon name={ICONS[row.key]} className="text-xl text-forest-700" />
              {row.title}
            </dt>
            <dd className="min-w-0">
              <span className="font-display text-lg font-bold tabular-nums text-ink">{row.value}</span>
              {row.valueNote && <span className="ml-1.5 text-[14px] text-ink-faint">{row.valueNote}</span>}
              {row.arsFromUsd != null && (
                <span className="mt-0.5 flex items-center text-[14px] tabular-nums text-ink-soft">{ars(row)}</span>
              )}
              {row.key === "empty_month" ? (
                row.emptyPercent != null ? (
                  <span className="mt-1 block space-y-1.5 text-[14px] leading-snug text-ink-soft">
                    <span className="block">{EMPTY_MONTH_IDEA}</span>
                    <span className="block">{EMPTY_MONTH_RULES}</span>
                    <span className="block font-semibold text-ink">{emptyMonthExample(row.emptyPercent)}</span>
                    <span className="block">
                      <FaqLink />.
                    </span>
                  </span>
                ) : (
                  <span className="mt-1 block text-[14px] leading-snug text-ink-soft">
                    Esta residencia no cobra por el tiempo en que la plaza queda libre antes de tu ingreso.
                  </span>
                )
              ) : (
                <span className="mt-1 block text-[14px] leading-snug text-ink-soft">{row.help}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
