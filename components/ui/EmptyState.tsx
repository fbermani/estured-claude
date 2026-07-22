import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Nombre de ícono Material Symbols — icon-tile opcional arriba del título (fresh-style.md §2 "Cards"). */
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-line-2 bg-cream px-6 py-14 text-center">
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-ink-faint">
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
