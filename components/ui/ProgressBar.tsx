import type { CSSProperties } from "react";

/**
 * Barra de progreso accesible que se llena con `scaleX` (600ms, --ease-out-fresh): anima solo transform,
 * nunca `width`. `value` es 0–100. Con prefers-reduced-motion el relleno cambia con fundido corto, sin deslizar.
 */
export function ProgressBar({
  value,
  label,
  className = "h-2.5",
  trackClassName = "bg-cream-2",
}: {
  value: number;
  label: string;
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`overflow-hidden rounded-full ${trackClassName} ${className}`}
    >
      <div className="pb-fill h-full w-full rounded-full bg-forest" style={{ "--p": pct / 100 } as CSSProperties} />
    </div>
  );
}
