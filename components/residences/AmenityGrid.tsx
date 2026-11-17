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
  tone = "line",
}: {
  items: AmenityItem[];
  columns?: 1 | 2;
  /** `chips` (DR30): píldoras horizontales con ícono, en fila con wrap. */
  layout?: "list" | "chips";
  /** Solo con `chips`. `tag` = etiqueta de «Vivir acá» del mockup (forest-tint, texto forest-700, sin ícono ni borde); `line` = píldora con borde e ícono. */
  tone?: "line" | "tag";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const tag = layout === "chips" && tone === "tag";

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
              tag
                ? "min-h-9 rounded-full bg-forest-tint px-3.5 hover:bg-forest-tint/70"
                : layout === "chips"
                  ? "gap-2 rounded-full border border-line bg-paper px-3 py-1.5 hover:bg-cream-2"
                  : "w-full gap-3 rounded-field px-2.5 py-2 hover:bg-cream-2"
            }  transition-colors duration-200 ease-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}
          >
            {!tag && (
              <Icon
                name={item.icon}
                className={`shrink-0 ${layout === "chips" ? "text-lg" : "text-xl"} text-ink-soft transition-colors duration-200 ease-fresh group-hover:text-forest-700`}
              />
            )}
            <span
              className={
                tag
                  ? "text-sm font-semibold text-forest-700"
                  : "text-sm text-ink-soft transition-colors duration-200 ease-fresh group-hover:text-ink"
              }
            >
              {item.name}
            </span>
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
