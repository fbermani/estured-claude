import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

export interface MetricPart {
  pct: number;
  /** "main" = tono del rol; "warm" = ámbar; "rest" = gris. */
  kind?: "main" | "warm" | "rest";
}

const PART_CLASS: Record<NonNullable<MetricPart["kind"]>, string> = {
  main: "bg-(--tone)",
  warm: "bg-amber-soft-400",
  rest: "bg-line-2",
};

/**
 * Métrica del kit: número grande, etiqueta y una línea de contexto. La barra solo va si hay proporción real.
 * `example` agrega la marca «Ejemplo» (datos de muestra). Server Component.
 */
export function MetricCard({
  tone,
  icon,
  label,
  value,
  unit,
  hint,
  progress,
  example = false,
  className = "",
}: {
  tone?: RoleTone;
  icon: string;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  progress?: { parts: MetricPart[]; label: string };
  example?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${toneClass(tone)} grid gap-1.5 rounded-card border border-line bg-paper p-4 shadow-card ${className}`}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.05em] text-ink-faint">
        <Icon name={icon} className="text-lg text-(--tone)" />
        {label}
        {example && <ExampleMark />}
      </span>
      <span className="font-display text-[2.1rem] font-bold leading-none tracking-tight tabular-nums text-(--tone-ink)">
        {value}
        {unit && <small className="ml-1 font-sans text-[15px] font-semibold tracking-normal text-ink-faint">{unit}</small>}
      </span>
      {progress && (
        <div
          role="img"
          aria-label={progress.label}
          className="mt-0.5 flex h-2 overflow-hidden rounded-full bg-cream-2"
        >
          {progress.parts.map((p, i) => (
            <i key={i} className={`block h-full ${PART_CLASS[p.kind ?? "main"]}`} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />
          ))}
        </div>
      )}
      {hint && <span className="text-[12.5px] text-ink-faint">{hint}</span>}
    </div>
  );
}

/** Marca «Ejemplo» para datos de muestra. */
export function ExampleMark() {
  return (
    <span className="rounded-field bg-cream-2 px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.07em] text-ink-faint">
      Ejemplo
    </span>
  );
}
