"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type RotatingBenefit = {
  icon: string;
  title: string;
  /** Card resumida (columna derecha): 1-2 líneas. */
  summary: string;
  /** Panel destacado (columna izquierda) al activarse. */
  problem: string;
  solution: string;
  conclusion: string;
};

/**
 * Sección "beneficios" interactiva y reutilizable: 1 destacado (izquierda,
 * con estructura problema/solución/conclusión) + el resto resumido
 * (derecha, clickeable). Rota automáticamente y se pausa al hover; el
 * click reinicia el temporizador porque el efecto depende de `active`.
 * Respeta prefers-reduced-motion desapareciendo la rotación automática
 * (el usuario todavía puede click-activar cualquier ítem).
 */
export function RotatingBenefits({
  items,
  intervalMs = 6500,
}: {
  items: RotatingBenefit[];
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || items.length <= 1) return;
    const timer = setTimeout(() => {
      setActive((i) => (i + 1) % items.length);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [active, paused, reducedMotion, intervalMs, items.length]);

  const featured = items[active];
  const rest = items.map((item, i) => ({ item, i })).filter(({ i }) => i !== active);

  return (
    <div
      className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-stretch"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocusCapture={(e) => e.target instanceof HTMLElement && e.target.matches(":focus-visible") && setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        key={active}
        className="benefit-fade-in flex flex-col justify-center rounded-card border-2 border-forest-tint bg-forest-tint/40 p-8 sm:p-10"
      >
        <Icon name={featured.icon} className="text-4xl text-forest-700" />
        <h3 className="mt-6 font-display text-2xl font-bold text-ink sm:text-3xl">{featured.title}</h3>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-orange-700">Lo que suele pasar</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{featured.problem}</p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-forest-700">Cómo es con EstuRed</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{featured.solution}</p>
          </div>
        </div>

        <p className="mt-5 rounded-field bg-paper px-4 py-3 text-sm font-bold text-ink shadow-sm">
          {featured.conclusion}
        </p>

        {items.length > 1 && (
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-line/70">
            <div
              key={active}
              className="h-full rounded-full bg-forest"
              style={{
                animationName: "benefit-progress",
                animationDuration: `${intervalMs}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col divide-y divide-line rounded-card border-[1.5px] border-line bg-paper p-2 shadow-card sm:p-3">
        {rest.map(({ item, i }) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActive(i)}
            className="flex items-start gap-3 rounded-field p-4 text-left transition duration-200 ease-out-fresh hover:-translate-y-0.5 hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <Icon name={item.icon} className="mt-0.5 shrink-0 text-xl text-forest-700" />
            <div>
              <h3 className="font-bold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.summary}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
