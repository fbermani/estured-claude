import { Icon } from "@/components/ui/Icon";
import { TONE, type BentoItem } from "@/components/marketing/BenefitBento";

/**
 * Comparativo «A ciegas → Con EstuRed» (/for-students · Beneficios). Tabla real: en escritorio tres columnas
 * (beneficio, a ciegas, con EstuRed); en móvil cada fila se apila y la etiqueta «A ciegas:» vuelve
 * dentro de la celda. Reusa los ítems de `BenefitBento` (sin mini-pruebas visuales). Server Component, sin movimiento.
 * Los roles ARIA explícitos mantienen la semántica de tabla aunque en móvil los elementos pasen a `display:block`.
 */
export function BenefitCompare({ items, label }: { items: BentoItem[]; label: string }) {
  return (
    <table
      role="table"
      aria-label={label}
      className="block w-full md:table md:table-fixed md:border-separate md:border-spacing-0"
    >
      <thead role="rowgroup" className="hidden md:table-header-group">
        <tr role="row">
          <th scope="col" role="columnheader" className="w-[29%] px-[22px] pb-3 text-left">
            <span className="sr-only">Beneficio</span>
          </th>
          <th
            scope="col"
            role="columnheader"
            className="w-[32%] rounded-t-card bg-ink px-[22px] py-3.5 text-left text-[15px] font-bold text-paper"
          >
            <span className="flex items-center gap-1.5">
              <Icon name="visibility_off" className="text-[19px]" />
              A ciegas
            </span>
          </th>
          <th
            scope="col"
            role="columnheader"
            className="rounded-t-card bg-forest px-[22px] py-3.5 text-left text-[15px] font-bold text-paper"
          >
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" className="text-[19px] [font-variation-settings:'FILL'_1]" />
              Con EstuRed
            </span>
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup" className="block md:table-row-group">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          const sep = i > 0 ? "border-t border-line-2 md:border-t" : "md:border-t md:border-line-2";
          return (
            <tr key={it.title} role="row" className="block md:table-row">
              <th
                scope="row"
                role="rowheader"
                className={`block px-0 pb-2.5 pt-[22px] text-left font-normal md:table-cell md:px-[22px] md:py-5 md:align-middle ${sep} ${
                  i === 0 ? "border-t-0 pt-0 md:border-t md:pt-5" : ""
                } ${last ? "md:border-b md:border-line-2" : ""}`}
              >
                <span className="flex items-center gap-3.5">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-field ${TONE[it.tone]}`}>
                    <Icon name={it.icon} className="text-2xl" />
                  </span>
                  <span className="font-display text-[19px] font-bold leading-tight tracking-tight text-ink">{it.title}</span>
                </span>
              </th>
              <td
                role="cell"
                className={`block pb-2.5 text-sm text-ink-faint md:table-cell md:px-[22px] md:py-5 md:align-middle md:text-[15px] md:border-t md:border-line-2 ${
                  last ? "md:border-b" : ""
                }`}
              >
                <span className="flex items-start gap-2">
                  <Icon name="remove" className="mt-px text-[19px] text-orange-700" />
                  <span>
                    <span className="mr-1.5 inline-block rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-paper md:hidden">A ciegas</span>
                    {it.before}
                  </span>
                </span>
              </td>
              <td
                role="cell"
                className={`mb-[22px] block rounded-[14px] border border-line bg-paper px-3.5 py-3 text-[15px] font-medium text-ink md:mb-0 md:table-cell md:rounded-none md:border-x md:border-y-0 md:px-[22px] md:py-5 md:align-middle md:text-base ${
                  last ? "md:rounded-b-card md:border-b md:shadow-[0_8px_18px_-10px_rgb(29_39_34/.14)]" : ""
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <Icon name="check_circle" className="mt-px text-[21px] text-forest [font-variation-settings:'FILL'_1]" />
                  <span>
                    <span className="mb-1 block w-fit rounded-md bg-forest px-1.5 py-0.5 text-xs font-bold text-paper md:hidden">Con EstuRed</span>
                    {it.yes}
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
