"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

type AmenityItem = { name: string; icon: string; description: string };

/**
 * Grilla de ícono + nombre con tooltip al hover — mismo componente para
 * "Servicios incluidos" y "Áreas comunes" (mismo estilo visual exacto,
 * pedido del dueño). Hover: eleva + escala sutil + resalta el ícono;
 * en mobile el tooltip se abre con tap (mismo mecanismo que InfoTip).
 */
export function AmenityGrid({ items }: { items: AmenityItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item, i) => (
        <div
          key={item.name}
          className="group relative"
          onMouseEnter={() => setOpenIndex(i)}
          onMouseLeave={() => setOpenIndex((v) => (v === i ? null : v))}
        >
          <button
            type="button"
            onClick={() => setOpenIndex((v) => (v === i ? null : i))}
            onFocus={() => setOpenIndex(i)}
            onBlur={() => setOpenIndex((v) => (v === i ? null : v))}
            aria-expanded={openIndex === i}
            className="flex w-full flex-col items-center gap-2 rounded-field border-[1.5px] border-line bg-paper px-3 py-4 text-center transition-all duration-300 ease-bounce hover:-translate-y-1 hover:scale-[1.03] hover:border-forest-tint hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-tint text-forest-700 transition-transform duration-300 ease-bounce group-hover:scale-110">
              <Icon name={item.icon} className="text-xl" />
            </span>
            <span className="text-xs font-semibold leading-tight text-ink-soft">{item.name}</span>
          </button>

          {openIndex === i && (
            <div
              role="tooltip"
              className="benefit-fade-in absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-field border-[1.5px] border-line bg-paper p-2.5 text-center text-[11px] leading-relaxed text-ink-soft shadow-float"
            >
              {item.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
