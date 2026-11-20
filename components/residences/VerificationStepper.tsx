import { Icon } from "@/components/ui/Icon";
import type { ChipTone, StageState, VerificationProgress } from "@/lib/residences/verificationStages";

const chipTones: Record<ChipTone, string> = {
  info: "bg-info-bg text-info-fg",
  warning: "bg-warning-bg text-warning-fg",
  success: "bg-success-bg text-success-fg",
};

const chipIcons: Record<ChipTone, string> = {
  info: "hourglass_top",
  warning: "edit_note",
  success: "verified",
};

/** Estado principal de la residencia, junto al nombre en la cabecera del Panel. */
export function VerificationStatusChip({ progress }: { progress: VerificationProgress }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${chipTones[progress.chip.tone]}`}>
      <Icon name={chipIcons[progress.chip.tone]} className="text-base" />
      {progress.chip.label}
    </span>
  );
}

const dotClasses: Record<StageState, string> = {
  done: "bg-forest text-white",
  current: "border-2 border-forest bg-forest-tint text-forest-700",
  upcoming: "border-2 border-line-2 bg-paper text-ink-faint",
};

const labelClasses: Record<StageState, string> = {
  done: "text-ink",
  current: "text-ink",
  upcoming: "text-ink-soft",
};

/**
 * Etapas del alta de una residencia (Configuración, En verificación, Verificada, Publicada).
 * Lista ordenada con `aria-current="step"` en la etapa actual; el estado de cada etapa va con texto, no solo con color.
 * Vertical en celular y horizontal desde `sm`. Con la residencia ya publicada pasa a una línea compacta.
 */
export function VerificationStepper({ progress }: { progress: VerificationProgress }) {
  if (progress.complete) {
    return (
      <section aria-label="Etapas de la residencia" className="mt-6 rounded-card border-[1.5px] border-line bg-paper px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
            <Icon name="check_circle" className="shrink-0 text-xl text-forest-700" />
            {progress.currentLine}
            <span className="font-normal text-ink-soft">{progress.now}</span>
          </p>
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {progress.stages.map((stage) => (
              <li key={stage.key} className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
                <Icon name="check" className="text-sm text-forest-700" />
                {stage.label} <span className="sr-only">({stage.stateLabel.toLowerCase()})</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="etapas-titulo" className="mt-6 rounded-card border-[1.5px] border-line bg-paper p-4 sm:p-5">
      <h2 id="etapas-titulo" className="font-display text-lg font-bold text-ink">
        {progress.currentLine}
      </h2>
      {progress.alert && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-field bg-warning-bg px-3 py-1.5 text-sm font-bold text-warning-fg">
          <Icon name="priority_high" className="text-base" />
          {progress.alert}
        </p>
      )}
      <ol className="mt-4 grid gap-0 sm:grid-cols-4 sm:gap-3">
        {progress.stages.map((stage, index) => {
          const isCurrent = stage.state === "current";
          const isLast = index === progress.stages.length - 1;
          return (
            <li
              key={stage.key}
              aria-current={isCurrent ? "step" : undefined}
              className="flex gap-3 sm:flex-col sm:gap-2"
            >
              <div className="flex flex-col items-center sm:w-full sm:flex-row">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${dotClasses[stage.state]}`}
                >
                  {stage.state === "done" ? <Icon name="check" className="text-xl" /> : stage.position}
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`my-1 min-h-4 w-0.5 flex-1 sm:my-0 sm:ml-2 sm:h-0.5 sm:min-h-0 sm:w-auto ${stage.state === "done" ? "bg-forest" : "bg-line-2"}`}
                  />
                )}
              </div>
              <div className={isLast ? "min-w-0" : "min-w-0 pb-4 sm:pb-0"}>
                <p className={`text-sm font-bold ${labelClasses[stage.state]}`}>{stage.label}</p>
                <p className={`text-xs ${isCurrent ? "font-bold text-forest-700" : "text-ink-soft"}`}>{stage.stateLabel}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-ink">{progress.now}</p>
      <p className="mt-1 text-sm text-ink-soft">
        <span className="font-bold">Sigue: </span>
        {progress.next}
      </p>
    </section>
  );
}
