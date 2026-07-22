"use client";

import { Reveal } from "@/components/ui/Reveal";
import { HoverDetail } from "@/components/ui/HoverDetail";

type Step = { text: string; detail: string };

/** Client component: ver nota en components/ui/HoverFeatureList.tsx sobre el RSC boundary. */
export function StepsList({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-1 border-l-2 border-dashed border-line pl-6">
      {steps.map((step, i) => (
        <Reveal key={i} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
          <li className="relative">
            <HoverDetail detail={step.detail} className="-ml-2 rounded-field px-2 py-2.5">
              {(open) => (
                <div className="flex gap-4">
                  <span
                    className={`absolute -left-[34px] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white ring-4 ring-surface transition-colors duration-300 ${
                      open ? "bg-forest-600" : "bg-forest"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className={`text-sm transition-all duration-300 sm:text-base ${open ? "font-semibold text-ink" : "text-ink-soft"}`}>
                    {step.text}
                  </p>
                </div>
              )}
            </HoverDetail>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}
