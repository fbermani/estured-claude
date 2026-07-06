import type { ReactNode } from "react";

type Tone = "neutral" | "petrol" | "sage" | "amber";

const tones: Record<Tone, string> = {
  neutral: "bg-sand-100 text-ink-soft",
  petrol: "bg-petrol-50 text-petrol-700",
  sage: "bg-sage-50 text-sage-700",
  amber: "bg-amber-soft-100 text-amber-soft-700",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
