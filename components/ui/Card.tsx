import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  interactive = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
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
