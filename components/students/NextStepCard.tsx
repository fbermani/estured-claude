import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JOURNEY_STEPS, type NextStep } from "@/lib/students/journeyStage";
import "@/components/marketing/hero-motion.css";

/** Las 6 etapas del camino a la reserva. Las anteriores a `stage` figuran completas, `stage` es la actual. */
export function JourneyStepper({ stage }: { stage: number }) {
  return (
    <ol className="flex justify-between" aria-label="Tu camino a la reserva">
      {JOURNEY_STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < stage ? "done" : n === stage ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={`relative grid flex-1 justify-items-center gap-1.5 text-center text-[11px] font-semibold md:text-[12.5px] ${
              state === "done" ? "text-forest-700" : state === "current" ? "text-orange-700" : "text-ink-faint"
            }`}
          >
            {n < JOURNEY_STEPS.length && (
              <span
                aria-hidden="true"
                className={`absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-[15px] h-[3px] rounded ${
                  state === "done" ? "bg-forest" : "bg-line"
                }`}
              />
            )}
            <span
              className={`relative z-[1] flex size-[30px] items-center justify-center rounded-full text-[13px] font-bold ${
                state === "done"
                  ? "bg-forest text-white"
                  : state === "current"
                    ? "hero-pulse-orange bg-orange text-white"
                    : "bg-cream-2 text-ink-faint"
              }`}
            >
              {state === "done" ? <Icon name="check" className="text-[17px]" /> : n}
            </span>
            <span>
              {label}
              <span className="sr-only">{state === "done" ? " (completado)" : state === "current" ? " (etapa actual)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** «Tu próximo paso» (propuesta A): el paso protagonista del dashboard, con CTA y las 6 etapas. */
export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      aria-labelledby="proximo-paso"
      className="overflow-hidden rounded-card border-[1.5px] border-l-[6px] border-line border-l-orange bg-paper shadow-card"
    >
      <div className="grid gap-2.5 p-5 md:p-7">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Tu próximo paso</span>
        <h2 id="proximo-paso" className="text-2xl font-bold leading-tight text-ink">
          {step.title}
        </h2>
        <p className="max-w-2xl text-ink-soft">{step.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          <Button href={step.primary.href}>
            {step.primary.label}
            <Icon name="arrow_forward" className="text-xl" />
          </Button>
          {step.secondary && (
            <Button href={step.secondary.href} variant="outline">
              {step.secondary.label}
            </Button>
          )}
        </div>
      </div>
      <div className="px-3 pb-6 pt-1 md:px-7">
        <JourneyStepper stage={step.stage} />
      </div>
    </section>
  );
}
