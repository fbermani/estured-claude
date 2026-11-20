"use client";

import { CollapsibleGroup } from "@/components/residences/CollapsibleGroup";
import { FaqCatalogItem } from "@/app/residence/[residence_id]/faq/FaqCatalogItem";
import { useFaqEditor } from "@/app/residence/[residence_id]/faq/FaqEditor";
import { FAQ_CATEGORIES } from "@/lib/faq/catalog";

/**
 * Preguntas del catálogo agrupadas por tema. Todos los temas arrancan cerrados. Las preguntas siguen montadas aunque el tema esté
 * cerrado (un `<details>` no desmonta), así que sus ediciones sin guardar no se pierden y entran en «Guardar todo y volver».
 * Cada tema muestra cuántas preguntas ya se ven en la ficha (lo guardado) y cuántas tienen cambios sin guardar.
 */
export function FaqCatalogEditor() {
  const ed = useFaqEditor();
  return (
    <div className="space-y-3">
      {FAQ_CATEGORIES.map((category) => {
        const entries = ed.items.filter((i) => i.category === category.key);
        if (entries.length === 0) return null;
        const unsaved = entries.filter((e) => ed.dirtyIds.has(e.id)).length;
        return (
          <CollapsibleGroup
            key={category.key}
            title={category.label}
            open={ed.openCats.has(category.key)}
            onToggle={() => ed.toggleCat(category.key)}
            summary={
              <>
                {unsaved > 0 && (
                  <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold tabular-nums text-warning-fg">
                    {unsaved} sin guardar
                  </span>
                )}
                <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-soft">
                  {entries.filter((e) => ed.saved[e.id]?.selected).length} de {entries.length} en tu ficha
                </span>
              </>
            }
          >
            <div className="space-y-3 px-3 pb-3">
              {entries.map((entry) => (
                <FaqCatalogItem key={entry.id} id={entry.id} />
              ))}
            </div>
          </CollapsibleGroup>
        );
      })}
    </div>
  );
}
