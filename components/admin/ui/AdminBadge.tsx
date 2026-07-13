import type { ReactNode } from "react";
import { cmd } from "@/components/admin/ui/tokens";

type Tone = "neutral" | "amber" | "emerald" | "rose" | "violet" | "primary";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: cmd.surfaceContainer, fg: cmd.onSurfaceVariant },
  amber: { bg: cmd.amberBg, fg: cmd.amber },
  emerald: { bg: cmd.emeraldBg, fg: cmd.emerald },
  rose: { bg: cmd.roseBg, fg: cmd.rose },
  violet: { bg: cmd.violetBg, fg: cmd.violet },
  primary: { bg: cmd.emeraldBg, fg: cmd.primary },
};

/** Status pill del panel admin — pill (999px), fresh-style.md §2 "Chips / pills / badges". */
export function AdminBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}
