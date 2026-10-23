import { Icon } from "@/components/ui/Icon";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import { buildConditionItems, type FichaConditionsInput } from "@/lib/residences/fichaConditions";

/**
 * Condiciones de la residencia visibles para todos (SPEC §4.1). Cada ítem lleva ícono, rótulo, valor y una
 * línea de ayuda; si el dato no está cargado, la fila no se muestra (`buildConditionItems`).
 */
export function ReservationConditions({
  conditions,
  arsPerUsd,
}: {
  conditions: FichaConditionsInput;
  arsPerUsd: number;
}) {
  const items = buildConditionItems(conditions);
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {items.map((item) => (
        <li key={item.key} className="rounded-sm border-[1.5px] border-line bg-paper p-3.5 shadow-card sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
            <Icon name={item.icon} className="text-base text-forest-700" />
            {item.label}
          </p>
          <p className="mt-1.5 font-display text-xl font-extrabold leading-tight text-ink">
            {item.value}
            {item.valueNote && <span className="ml-1.5 text-xs font-semibold text-ink-faint">({item.valueNote})</span>}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            {item.help}
            {item.arsFromUsd != null && (
              <span className="mt-0.5 block text-ink-faint">
                ≈ {formatArs(usdToArsRounded(item.arsFromUsd, arsPerUsd))}
                <ExchangeRateNote />
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
