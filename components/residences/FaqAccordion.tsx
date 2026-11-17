"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Acordeón moderno, una sola pregunta abierta a la vez, apertura suave. */
export function FaqAccordion({
  items: allItems,
  visibleLimit,
  onDark = false,
  initialOpen = 0,
}: {
  items: { question: string; answer: string; fromVisitor?: boolean; group?: string }[];
  /** Si se pasa, muestra solo esa cantidad y un botón «Ver todas las preguntas» (DR18: la ficha muestra 10). */
  visibleLimit?: number;
  /** Sobre un fondo forest-ink (banda de preguntas destacadas de la ficha): las tarjetas siguen en paper y el foco se dibuja adentro, en ink. */
  onDark?: boolean;
  /** Índice de la pregunta abierta al montar (por defecto la primera); `null` = todas cerradas (lista larga, como el modal de la ficha). */
  initialOpen?: number | null;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpen);
  const [showAll, setShowAll] = useState(false);
  const baseId = useId();
  const hasMore = visibleLimit !== undefined && allItems.length > visibleLimit;
  const items = hasMore && !showAll ? allItems.slice(0, visibleLimit) : allItems;

  return (
    <div className="space-y-3">
      {items.map((faq, i) => {
        const open = openIndex === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-btn-${i}`;
        // Encabezado del tema (catálogo, DR14) cuando cambia el grupo respecto de la pregunta anterior.
        const showGroup = faq.group && faq.group !== items[i - 1]?.group;
        return (
          <div key={`${i}-${faq.question}`} className="space-y-3">
            {showGroup && (
              <h3 className={`text-sm font-bold ${onDark ? "text-[color:var(--paper-88)]" : "text-muted"} ${i > 0 ? "pt-3" : ""}`}>{faq.group}</h3>
            )}
          <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
            <button
              type="button"
              onClick={() => setOpenIndex((v) => (v === i ? null : i))}
              id={buttonId}
              aria-expanded={open}
              aria-controls={panelId}
              className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-2 focus-visible:outline-2 ${
                onDark
                  ? "focus-visible:outline-offset-[-4px] focus-visible:outline-forest-ink!"
                  : "focus-visible:outline-offset-2 focus-visible:outline-forest"
              }`}
            >
              <span className="min-w-0">
                {faq.fromVisitor && (
                  <span className="mb-0.5 block text-xs font-bold text-forest-700">
                    Pregunta de un visitante
                  </span>
                )}
                <span className="whitespace-pre-line break-words font-semibold text-ink">{faq.question}</span>
              </span>
              <Icon
                name="expand_more"
                className={`shrink-0 text-xl text-forest-700 transition-transform duration-300 ease-fresh ${open ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id={panelId}
              aria-labelledby={buttonId}
              inert={!open}
              className="grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-fresh"
              style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden" }}
            >
              <div className="overflow-hidden">
                <p className="whitespace-pre-line break-words px-5 pb-4 text-sm leading-relaxed text-ink-soft">{faq.answer}</p>
              </div>
            </div>
          </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="cursor-pointer text-sm font-bold text-forest-700 underline-offset-2 hover:underline"
        >
          {showAll ? "Ver menos preguntas" : `Ver todas las preguntas (${allItems.length})`}
        </button>
      )}
    </div>
  );
}
