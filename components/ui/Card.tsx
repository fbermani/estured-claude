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
      className={`bg-paper rounded-card shadow-card border-[1.5px] border-line ${
        interactive
          ? "transition-all duration-300 ease-bounce hover:-translate-y-[7px] hover:border-transparent hover:shadow-lg"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
