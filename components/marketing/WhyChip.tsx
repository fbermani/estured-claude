"use client";

import { Icon } from "@/components/ui/Icon";
import { HoverDetail } from "@/components/ui/HoverDetail";

/** Chip de «Por qué EstuRed»: detalle al hover, foco o tap (HoverDetail). Cliente solo por la render-prop. */
export function WhyChip({ icon, label, detail }: { icon: string; label: string; detail: string }) {
  return (
    <HoverDetail detail={detail} className="rounded-card border border-sand-200 bg-sand-50 px-4 py-3">
      {(open) => (
        <p className="flex items-center gap-2.5 font-display text-base font-bold text-ink">
          <span
            className={`flex size-8 items-center justify-center rounded-full transition-colors ${
              open ? "bg-forest text-white" : "bg-forest-tint text-forest-700"
            }`}
          >
            <Icon name={icon} className="text-lg" />
          </span>
          {label}
        </p>
      )}
    </HoverDetail>
  );
}
