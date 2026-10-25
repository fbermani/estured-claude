"use client";

import { Reveal } from "@/components/ui/Reveal";
import { HoverDetail } from "@/components/ui/HoverDetail";

type Step = { title: string; description: string; detail: string };

/** Client component: ver nota en HoverFeatureList.tsx sobre el RSC boundary. */
export function HowItWorksSteps({ steps }: { steps: Step[] }) {
  return (
    <div
      className={`grid gap-6 sm:grid-cols-2 ${steps.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
    >
      {steps.map((step, i) => (
        <Reveal key={step.title} delay={(Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5)} className="relative">
          <HoverDetail
            detail={step.detail}
            className="h-full rounded-card border-[1.5px] border-line bg-paper p-6 shadow-card"
          >
            {(open) => (
              <>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-extrabold transition-colors duration-300 ${
                    open ? "bg-orange text-white" : "bg-orange-tint text-orange-700"
                  }`}
                >
                  {i + 1}
                </span>
                <h3 className={`mt-4 text-ink transition-all duration-300 ${open ? "font-extrabold" : "font-bold"}`}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.description}</p>
              </>
            )}
          </HoverDetail>
        </Reveal>
      ))}
    </div>
  );
}
