import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`bg-surface rounded-card shadow-card border border-sand-200 ${
        interactive ? "transition-shadow hover:shadow-card-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
