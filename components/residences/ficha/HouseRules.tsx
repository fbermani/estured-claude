import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { moreRulesLabel, parseRuleLines, splitRuleLine, splitRules } from "@/lib/residences/fichaRules";

/**
 * Lista de reglas al estilo del mockup: filas separadas por filetes, con el número de la regla a la izquierda (display, forest-700) y a la
 * derecha el título destacado y el detalle debajo. Si la regla no trae «Título: detalle», va entera como texto.
 */
function RuleList({ rules, offset = 0 }: { rules: string[]; offset?: number }) {
  return (
    <ol role="list" className="m-0 grid list-none gap-0 p-0">
      {rules.map((rule, i) => {
        const { title, body } = splitRuleLine(rule);
        return (
          <li
            key={`${offset + i}-${rule}`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-t-[1.5px] border-line py-3.5 first:border-t-0 min-[640px]:grid-cols-[4.5rem_minmax(0,1fr)] min-[640px]:gap-x-4"
          >
            <span aria-hidden="true" className="font-display text-xl font-bold tabular-nums text-forest-700">
              {String(offset + i + 1).padStart(2, "0")}
            </span>
            <p className="min-w-0 [overflow-wrap:anywhere]">
              {title && <strong className="block text-[17px] font-bold leading-snug text-ink">{title}</strong>}
              <span className={title ? "block text-[15px] leading-snug text-ink-soft" : "block text-[16px] leading-snug text-ink"}>{body}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Reglas de casa principales (capítulo «Reglas de casa»): hasta 5 reglas a la vista como lista escaneable y el resto en un
 * desplegable («Ver N reglas más»), sin perder ninguna. `actions` trae los botones del reglamento (leer en el modal y descargar), que
 * arma la página según lo que la residencia cargó. Sin reglas ni acciones no se dibuja nada.
 */
export function HouseRules({ rulesSummary, actions }: { rulesSummary: string; actions?: ReactNode }) {
  const { primary, more } = splitRules(parseRuleLines(rulesSummary));
  if (primary.length === 0 && !actions) return null;
  return (
    <div className="space-y-4">
      {primary.length > 0 && (
        <div className="rounded-card border-[1.5px] border-line bg-paper px-4 py-1 shadow-card min-[640px]:px-5">
          <RuleList rules={primary} />
        </div>
      )}
      {more.length > 0 && (
        <details className="group rounded-card border-[1.5px] border-line bg-paper">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-card px-4 py-2.5 text-[15px] font-bold text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
            {moreRulesLabel(more.length)}
            <Icon name="expand_more" className="text-xl transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t-[1.5px] border-line px-4 min-[640px]:px-5">
            <RuleList rules={more} offset={primary.length} />
          </div>
        </details>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** «Descargar el reglamento» cuando no hay reglamento para leer en el modal (p. ej. la residencia solo subió un PDF). */
export function RegulationDownloadLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-[15px] font-semibold text-ink transition-colors hover:border-forest hover:bg-forest-tint hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <Icon name="download" className="text-base" />
      Descargar el reglamento
    </a>
  );
}
