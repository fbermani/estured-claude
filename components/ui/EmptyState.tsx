import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-line-2 bg-cream px-6 py-14 text-center">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-ink-soft">{description}</p>
      )}
      {action}
    </div>
  );
}
