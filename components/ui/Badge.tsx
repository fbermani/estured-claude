import type { ReactNode } from "react";

type Tone = "neutral" | "petrol" | "sage" | "amber" | "danger";

/**
 * Sistema FRESH (design-references/fresh-style.md §2 "Chips / pills /
 * badges"): fondo tint + texto -700/-600 del mismo hue, nunca borde.
 * Los nombres de tone se mantienen (usados en ~15 páginas vía
 * STATUS_COPY) — lo que cambia es el color real: petrol→forest,
 * sage→mint, amber→orange.
 */
const tones: Record<Tone, string> = {
  neutral: "bg-cream-2 text-ink-soft",
  petrol: "bg-forest-tint text-forest-700",
  sage: "bg-mint text-forest-700",
  amber: "bg-orange-tint text-orange-700",
  danger: "bg-danger-bg text-danger-fg",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
