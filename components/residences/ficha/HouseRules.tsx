import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { buildRuleRows, moreRulesLabel, splitRules, type RuleRow } from "@/lib/residences/fichaRules";

/**
 * Lista de reglas 1:1 con el mockup (`.rules`): sin tarjeta, filas separadas por filetes de 1,5 px (también arriba y abajo), con una columna
 * izquierda de ancho fijo en display bold forest-700 («23 a 7», «Libre», «No») y a la derecha el título en negrita y el detalle debajo.
 * El dato de la izquierda lo carga la residencia (reglas estructuradas) o se LEE del texto de la regla (`ruleLead`); si la regla no trae
 * ese dato, lleva un ícono neutro en su lugar (nunca se inventa un «cuándo»). Una regla sin «Título: detalle» va entera como texto.
 */
function RuleList({ rules, offset = 0 }: { rules: RuleRow[]; offset?: number }) {
  return (
    <ul role="list" className="m-0 grid list-none gap-0 border-y-[1.5px] border-line p-0">
      {rules.map((rule, i) => {
        const { lead, title, body } = rule;
        return (
          <li
            key={`${offset + i}-${title ?? ""}-${body}`}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3.5 border-t-[1.5px] border-line py-3.5 first:border-t-0 min-[640px]:grid-cols-[6rem_minmax(0,1fr)]"
          >
            {lead ? (
              <span className="font-display text-xl font-bold leading-tight tabular-nums text-forest-700">{lead}</span>
            ) : (
              <span aria-hidden="true" className="flex items-start">
                <Icon name="home" className="text-2xl text-forest-700" />
              </span>
            )}
            <p className="min-w-0 [overflow-wrap:anywhere]">
              {title && <strong className="block text-base font-bold leading-snug text-ink">{title}</strong>}
              {body && <span className={title ? "block text-[15px] leading-snug text-ink-soft" : "block text-base leading-snug text-ink"}>{body}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Reglas de casa principales (capítulo «Reglas de casa»): hasta 6 reglas a la vista en el formato del mockup y el resto en un
 * desplegable («Ver N reglas más»), sin perder ninguna. Fuente: las reglas estructuradas de la residencia (`items`) o, si no cargó, las
 * que se derivan de su resumen de texto (`buildRuleRows`). `actions` trae los botones del reglamento (leer en el modal y descargar), que
 * arma la página según lo que la residencia cargó. Sin reglas ni acciones no se dibuja nada; sin reglas pero con acciones, solo los
 * botones (nunca una lista vacía).
 */
export function HouseRules({ rulesSummary, items, actions }: { rulesSummary?: string; items?: unknown; actions?: ReactNode }) {
  const { primary, more } = splitRules(buildRuleRows({ items, summary: rulesSummary }));
  if (primary.length === 0 && !actions) return null;
  return (
    <div className="space-y-4">
      {primary.length > 0 && <RuleList rules={primary} />}
      {more.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[15px] font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
            {moreRulesLabel(more.length)}
            <Icon name="expand_more" className="text-xl transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="mt-2">
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
