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
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-sand-300 bg-sand-50 px-6 py-14 text-center">
      <h3 className="text-lg font-semibold text-petrol-800">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-ink-soft">{description}</p>
      )}
      {action}
    </div>
  );
}
