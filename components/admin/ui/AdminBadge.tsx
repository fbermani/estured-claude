import type { ReactNode } from "react";
import { cmd } from "@/components/admin/ui/tokens";

type Tone = "neutral" | "amber" | "emerald" | "rose" | "violet" | "primary";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: cmd.surfaceContainer, fg: cmd.onSurfaceVariant },
  amber: { bg: cmd.amberBg, fg: cmd.amber },
  emerald: { bg: cmd.emeraldBg, fg: cmd.emerald },
  rose: { bg: cmd.roseBg, fg: cmd.rose },
  violet: { bg: cmd.violetBg, fg: cmd.violet },
  primary: { bg: cmd.onPrimaryContainer, fg: cmd.primary },
};

/** Status pill del design system "Operational Command" — radio 12px (vs. 4px de botones/inputs). */
export function AdminBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center rounded-[12px] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}
