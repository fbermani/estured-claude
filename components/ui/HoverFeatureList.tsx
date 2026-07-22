"use client";

import { Icon } from "@/components/ui/Icon";
import { HoverDetail } from "@/components/ui/HoverDetail";

export type HoverListItem = { label: string; detail: string };

const TONE = {
  forest: { idle: "bg-success-bg text-success-fg", active: "bg-forest text-white" },
  orange: { idle: "bg-orange-tint text-orange-600", active: "bg-orange text-white" },
  neutral: { idle: "bg-sand-200 text-ink-faint", active: "bg-red-tint text-red-700" },
} as const;

/**
 * Lista de features/diferencias interactiva y reutilizable — usada tal
 * cual en "Reservar con EstuRed vs. reservar por fuera" (home) y
 * "Planes" (for-residences). Server Components no pueden pasar
 * funciones como children a un Client Component (RSC boundary), así
 * que este componente vive enteramente del lado cliente: recibe solo
 * datos serializables (`items`, `icon`, `tone`) y arma el render-prop
 * de `HoverDetail` acá adentro.
 */
export function HoverFeatureList({
  items,
  icon = "check",
  tone = "forest",
  className = "",
}: {
  items: HoverListItem[];
  icon?: string;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const colors = TONE[tone];
  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((item) => (
        <li key={item.label}>
          <HoverDetail detail={item.detail} className="-mx-2 flex flex-col px-2 py-2">
            {(open) => (
              <div className="flex gap-3 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    open ? colors.active : colors.idle
                  }`}
                >
                  <Icon name={icon} className="text-sm" />
                </span>
                <span className={`transition-all duration-300 ${open ? "font-semibold text-ink" : "text-ink-soft"}`}>
                  {item.label}
                </span>
              </div>
            )}
          </HoverDetail>
        </li>
      ))}
    </ul>
  );
}
