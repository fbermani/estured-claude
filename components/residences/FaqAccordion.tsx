"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Acordeón moderno, una sola pregunta abierta a la vez, apertura suave. */
export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((faq, i) => {
        const open = openIndex === i;
        return (
          <div key={faq.question} className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
            <button
              type="button"
              onClick={() => setOpenIndex((v) => (v === i ? null : i))}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              <span className="font-semibold text-ink">{faq.question}</span>
              <Icon
                name="expand_more"
                className={`shrink-0 text-xl text-forest-700 transition-transform duration-300 ease-fresh ${open ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-fresh"
              style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-ink-soft">{faq.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
