import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone,
  variant = "empty",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Nombre de ícono Material Symbols — icon-tile opcional arriba del título (fresh-style.md §2 "Cards"). */
  icon?: string;
  /** Tono del rol (kit logueado): tiñe el ícono. Sin `tone` se ve neutro, como siempre. */
  tone?: RoleTone;
  /** `error`: borde y fondo de error (no pudimos cargarlo). */
  variant?: "empty" | "error";
}) {
  const isError = variant === "error";
  return (
    <div
      role={isError ? "alert" : undefined}
      className={`${toneClass(tone)} flex flex-col items-center justify-center gap-3 rounded-card px-6 py-14 text-center ${
        isError ? "border-[1.5px] border-danger-fg bg-danger-bg" : "border-[1.5px] border-dashed border-line-2 bg-cream"
      }`}
    >
      {icon && (
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            isError ? "bg-paper text-danger-fg" : tone ? "bg-(--tone-tint) text-(--tone-700)" : "bg-cream-2 text-ink-faint"
          }`}
        >
          <Icon name={icon} className="text-3xl" />
        </span>
      )}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-ink-soft">{description}</p>
      )}
      {action}
    </div>
  );
}
