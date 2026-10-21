import { formatDate } from "@/lib/dates/format";
import { Icon } from "@/components/ui/Icon";
import type { TimelineStep } from "@/lib/applications/timeline";

/**
 * Línea de tiempo simple de una solicitud (H07). Presentación pura sobre
 * `buildApplicationTimeline`: no decide estados, solo los dibuja. El estado
 * de cada paso se comunica también por texto (accesibilidad), no solo por color.
 */
const STATE_TEXT: Record<TimelineStep["state"], string> = {
  done: "Listo",
  current: "Sigue",
  upcoming: "Pendiente",
  stopped: "Frenado",
};

export function ApplicationTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0" aria-label="Recorrido de la solicitud">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dot =
          step.state === "done"
            ? "bg-forest text-white"
            : step.state === "current"
              ? "border-2 border-orange bg-orange-tint text-orange-700"
              : step.state === "stopped"
                ? "border-2 border-line-2 bg-sand-100 text-muted"
                : "border-2 border-line bg-paper text-muted";
        const icon =
          step.state === "done" ? "check" : step.state === "current" ? "arrow_forward" : step.state === "stopped" ? "pause" : "";
        return (
          <li key={step.key} className="flex gap-3" aria-current={step.state === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${dot}`}>
                {icon ? <Icon name={icon} className="text-base" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </span>
              {!isLast && (
                <span className={`my-1 w-0.5 flex-1 ${step.state === "done" ? "bg-forest" : "bg-line"}`} aria-hidden />
              )}
            </div>
            <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
              <p
                className={`text-sm font-semibold ${
                  step.state === "upcoming" || step.state === "stopped" ? "text-ink-soft" : "text-ink"
                }`}
              >
                {step.label}
                <span className="ml-2 text-xs font-medium text-ink-faint">
                  {STATE_TEXT[step.state]}
                  {step.at ? ` · ${formatDate(step.at)}` : ""}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
