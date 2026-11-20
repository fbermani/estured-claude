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
            className={`relative grid flex-1 justify-items-center gap-1.5 text-center text-xs font-semibold md:text-[12.5px] ${
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

/**
 * «Tu camino a la reserva» (kit logueado): gancho = título corto + las 6 etapas con la actual pulsando; el detalle
 * (explicación, link a todas las solicitudes y la aclaración de que una solicitud no es una reserva) queda bajo
 * «Más detalle» (`<details>` nativo, accesible por teclado). El CTA principal vive en el `PageHero` del dashboard.
 */
export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      aria-labelledby="proximo-paso"
      className="grid gap-4 overflow-hidden rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="proximo-paso" className="font-display text-xl font-bold leading-tight text-ink">
          {step.title}
        </h2>
        <span className="inline-flex items-center rounded-full bg-info-bg px-2.5 py-1 text-xs font-bold text-info-fg">
          <span className="tabular-nums">Paso {step.stage} de {JOURNEY_STEPS.length}</span>
        </span>
      </div>
      <JourneyStepper stage={step.stage} />
      <details className="group">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[13.5px] font-semibold text-forest-700 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
          Más detalle
          <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <div className="benefit-fade-in grid gap-3 text-sm text-ink-soft">
          <p className="max-w-2xl">{step.description}</p>
          {step.stage >= 3 && (
            <p className="flex gap-2 rounded-field bg-cream px-3 py-2 text-[12.5px]">
              <Icon name="info" className="text-lg text-forest-700" />
              Una solicitud no es una reserva: queda sujeta a confirmación de la residencia.
            </p>
          )}
          {step.secondary && (
            <div>
              <Button href={step.secondary.href} variant="outline" size="sm">
                {step.secondary.label}
              </Button>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
