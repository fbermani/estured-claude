"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { MAX_RULE_ITEMS, RULE_DETAIL_MAX, RULE_LEAD_MAX, RULE_TITLE_MAX, moveItem } from "@/lib/residences/ruleItems";

/** Fila en edición: `id` estable para reordenar sin perder el foco ni el texto. */
export type RuleDraft = { id: number; lead: string; title: string; detail: string };

let nextDraftId = 1;
export function newRuleDraft(partial: Partial<Omit<RuleDraft, "id">> = {}): RuleDraft {
  return { id: nextDraftId++, lead: partial.lead ?? "", title: partial.title ?? "", detail: partial.detail ?? "" };
}

const FIELD =
  "mt-1 block min-h-11 w-full rounded-field border-[1.5px] border-line-2 bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const ICON_BTN =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border-[1.5px] border-line-2 bg-paper px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-forest hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40 disabled:hover:border-line-2 disabled:hover:text-ink-soft";

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-xs tabular-nums text-ink-faint" aria-hidden="true">
      {value.length}/{max}
    </span>
  );
}

/**
 * Editor de «Reglas principales» de la ficha (hasta 6): cada fila lleva un dato grande opcional («23 a 7», «Libre»), un título y un
 * detalle opcional. Se agregan, quitan y reordenan con botones de 44 px. Es un componente controlado: el formulario guarda el estado y
 * manda las filas al servidor (que valida de nuevo: largos, HTML, enlaces y máximo).
 */
export function RulesItemsEditor({ rows, onChange }: { rows: RuleDraft[]; onChange: (rows: RuleDraft[]) => void }) {
  const baseId = useId();
  const update = (id: number, patch: Partial<RuleDraft>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div>
      <ul className="space-y-3" aria-label="Reglas principales">
        {rows.map((row, i) => (
          <li key={row.id} className="rounded-card border-[1.5px] border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink tabular-nums">Regla {i + 1}</p>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button type="button" className={ICON_BTN} disabled={i === 0} onClick={() => onChange(moveItem(rows, i, i - 1))} aria-label={`Subir la regla ${i + 1}`}>
                  <Icon name="arrow_upward" className="text-lg" />
                </button>
                <button
                  type="button"
                  className={ICON_BTN}
                  disabled={i === rows.length - 1}
                  onClick={() => onChange(moveItem(rows, i, i + 1))}
                  aria-label={`Bajar la regla ${i + 1}`}
                >
                  <Icon name="arrow_downward" className="text-lg" />
                </button>
                <button type="button" className={ICON_BTN} onClick={() => onChange(rows.filter((r) => r.id !== row.id))} aria-label={`Quitar la regla ${i + 1}`}>
                  <Icon name="delete" className="text-lg" />
                  Quitar
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`${baseId}-lead-${row.id}`} className="text-xs font-semibold text-ink-soft">
                    Dato (opcional)
                  </label>
                  <Counter value={row.lead} max={RULE_LEAD_MAX} />
                </div>
                <input
                  id={`${baseId}-lead-${row.id}`}
                  value={row.lead}
                  maxLength={RULE_LEAD_MAX}
                  onChange={(e) => update(row.id, { lead: e.target.value })}
                  placeholder="23 a 7"
                  className={FIELD}
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`${baseId}-title-${row.id}`} className="text-xs font-semibold text-ink-soft">
                    Título
                  </label>
                  <Counter value={row.title} max={RULE_TITLE_MAX} />
                </div>
                <input
                  id={`${baseId}-title-${row.id}`}
                  value={row.title}
                  maxLength={RULE_TITLE_MAX}
                  onChange={(e) => update(row.id, { title: e.target.value })}
                  placeholder="Silencio"
                  className={FIELD}
                />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`${baseId}-detail-${row.id}`} className="text-xs font-semibold text-ink-soft">
                  Detalle (opcional)
                </label>
                <Counter value={row.detail} max={RULE_DETAIL_MAX} />
              </div>
              <input
                id={`${baseId}-detail-${row.id}`}
                value={row.detail}
                maxLength={RULE_DETAIL_MAX}
                onChange={(e) => update(row.id, { detail: e.target.value })}
                placeholder="Para música o videos, auriculares"
                className={FIELD}
              />
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="rounded-field bg-cream-2 px-3 py-3 text-sm text-ink-soft">Todavía no cargaste reglas principales.</p>}
      {rows.length < MAX_RULE_ITEMS ? (
        <button
          type="button"
          onClick={() => onChange([...rows, newRuleDraft()])}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-forest-700 bg-paper px-4 text-sm font-bold text-forest-700 transition-colors hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <Icon name="add" className="text-lg" />
          Agregar una regla
        </button>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">Llegaste al máximo de {MAX_RULE_ITEMS} reglas principales. El resto va en el reglamento.</p>
      )}
    </div>
  );
}
