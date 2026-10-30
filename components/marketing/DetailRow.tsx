import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Fila expandible (gancho a la vista, detalle al abrir) con el mismo lenguaje que `for-students/StepsList`:
 * <details> nativo, accesible por teclado, sin JS. Server Component.
 */
export function DetailRow({
  icon,
  badge,
  title,
  hook,
  children,
}: {
  icon?: string;
  /** Número u otro texto corto en lugar del ícono. */
  badge?: string;
  title: string;
  hook: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-card border border-sand-200 bg-surface transition-shadow open:shadow-card hover:shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card p-4 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-field bg-forest-tint font-display text-lg font-bold text-forest-700"
        >
          {icon ? <Icon name={icon} className="text-2xl" /> : badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-ink">{title}</span>
          <span className="mt-0.5 block text-sm text-ink-soft">{hook}</span>
        </span>
        <Icon name="expand_more" className="shrink-0 text-2xl text-forest-700 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="benefit-fade-in border-t border-sand-200 p-4 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}
