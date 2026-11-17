import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { moreRulesLabel, parseRuleLines, splitRules } from "@/lib/residences/fichaRules";

const RULE_ICONS = ["rule", "schedule", "volume_off", "smoke_free", "groups"];

function RuleList({ rules, offset = 0 }: { rules: string[]; offset?: number }) {
  return (
    <ul role="list" className="grid list-none gap-2 p-0 sm:grid-cols-2">
      {rules.map((rule, i) => (
        <li key={`${offset + i}-${rule}`} className="flex items-start gap-2.5 rounded-field border-[1.5px] border-line bg-paper p-3">
          <Icon name={RULE_ICONS[(offset + i) % RULE_ICONS.length]} className="mt-0.5 shrink-0 text-lg text-forest-700" />
          <p className="min-w-0 text-[15px] leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{rule}</p>
        </li>
      ))}
    </ul>
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
      {primary.length > 0 && <RuleList rules={primary} />}
      {more.length > 0 && (
        <details className="group rounded-card border-[1.5px] border-line bg-paper">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-card px-4 py-2.5 text-[15px] font-bold text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
            {moreRulesLabel(more.length)}
            <Icon name="expand_more" className="text-xl transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t-[1.5px] border-line p-3">
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
