import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  interactive = false,
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      style={style}
      className={`bg-paper rounded-card shadow-card border-[1.5px] border-line ${
        interactive
          ? "transition duration-200 ease-out-fresh motion-safe:active:scale-[0.98] hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
