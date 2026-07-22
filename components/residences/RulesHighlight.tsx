import { Icon } from "@/components/ui/Icon";

const RULE_ICONS = ["rule", "schedule", "volume_off", "smoke_free", "groups"];

/**
 * Top 5 reglas destacadas — el reglamento completo no se muestra acá
 * a propósito (pedido del dueño: "que el usuario pueda comprender
 * rápidamente la convivencia sin leer un documento extenso"). El
 * resumen se interpreta como una regla por línea; si la residencia
 * escribió un solo párrafo, se muestra como un único ítem (fallback
 * razonable, no rompe nada).
 */
export function RulesHighlight({ rulesSummary, pdfUrl }: { rulesSummary: string; pdfUrl: string | null }) {
  const rules = rulesSummary
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (rules.length === 0 && !pdfUrl) return null;

  return (
    <div className="space-y-4">
      {rules.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rules.map((rule, i) => (
            <li
              key={rule}
              className="flex items-start gap-3 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
                <Icon name={RULE_ICONS[i % RULE_ICONS.length]} className="text-lg" />
              </span>
              <p className="text-sm leading-relaxed text-ink-soft">{rule}</p>
            </li>
          ))}
        </ul>
      )}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line-2 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-forest hover:bg-forest-tint hover:text-forest-700"
        >
          <Icon name="picture_as_pdf" className="text-lg" />
          Descargar reglamento completo (PDF)
        </a>
      )}
    </div>
  );
}
