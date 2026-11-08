"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

type AmenityItem = { name: string; icon: string; description: string };

/**
 * Fila de ícono + nombre con tooltip al hover — mismo componente para
 * "Servicios incluidos" y "Áreas comunes" (mismo estilo visual exacto,
 * pedido del dueño). Formato compacto tipo Airbnb: ícono chico en línea
 * con el texto, sin card pesada — el hover resalta el fondo de la fila
 * y el color del ícono, sutil, no una elevación dramática.
 */
export function AmenityGrid({
  items,
  columns = 2,
  layout = "list",
}: {
  items: AmenityItem[];
  columns?: 1 | 2;
  /** `chips` (DR30): píldoras horizontales con ícono, en fila con wrap. */
  layout?: "list" | "chips";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div
      className={
        layout === "chips"
          ? "flex flex-wrap gap-2"
          : `grid grid-cols-1 gap-x-6 gap-y-1 ${columns === 2 ? "sm:grid-cols-2" : ""}`
      }
    >
      {items.map((item, i) => (
        <div
          key={item.name}
          className="group relative"
          onKeyDown={(e) => e.key === "Escape" && setOpenIndex(null)}
          onPointerEnter={(e) => e.pointerType === "mouse" && setOpenIndex(i)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpenIndex((v) => (v === i ? null : v))}
        >
          <button
            type="button"
            onClick={() => setOpenIndex((v) => (v === i ? null : i))}
            onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpenIndex(i)}
            onBlur={() => setOpenIndex((v) => (v === i ? null : v))}
            aria-expanded={openIndex === i}
            className={`flex items-center text-left ${
              layout === "chips" ? "gap-2 rounded-full border border-line bg-paper px-3 py-1.5" : "w-full gap-3 rounded-field px-2.5 py-2"
            }  transition-colors duration-200 ease-fresh hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}
          >
            <Icon
              name={item.icon}
              className={`shrink-0 ${layout === "chips" ? "text-lg" : "text-xl"} text-ink-soft transition-colors duration-200 ease-fresh group-hover:text-forest-700`}
            />
            <span className="text-sm text-ink-soft transition-colors duration-200 ease-fresh group-hover:text-ink">{item.name}</span>
          </button>

          {openIndex === i && (
            <div
              role="tooltip"
              className="benefit-fade-in absolute bottom-full left-3 z-20 mb-1.5 w-48 rounded-field border-[1.5px] border-line bg-paper p-2.5 text-left text-xs leading-relaxed text-ink-soft shadow-float"
            >
              {item.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
