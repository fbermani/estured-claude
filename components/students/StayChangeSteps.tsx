import { buildStayChangeSteps } from "@/lib/stayChange/ui";
import type { StayChangeUiKey } from "@/lib/stayChange/status";

/**
 * Los 4 pasos del aviso "Quiero cambiar" (SPEC §3.4). Estado por relleno (hecho), anillo (actual) y vacío
 * (pendiente) además del texto, nunca solo por color. En mobile pasan a lista vertical.
 */
export function StayChangeSteps({ uiKey, hasResponse = false }: { uiKey: StayChangeUiKey; hasResponse?: boolean }) {
  const steps = buildStayChangeSteps(uiKey, hasResponse);
  return (
    <ol aria-label="Cómo sigue tu aviso" className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:gap-3">
      {steps.map((step, index) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2"
        >
          <span
            aria-hidden
            className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-extrabold ${
              step.state === "done"
                ? "border-forest bg-forest text-white"
                : step.state === "current"
                  ? "border-orange bg-paper text-orange-700 ring-4 ring-orange-tint"
                  : "border-line-2 bg-paper text-ink-faint"
            }`}
          >
            {step.state === "done" ? "✓" : index + 1}
          </span>
          <span
            className={`text-xs leading-snug ${
              step.state === "current" ? "font-bold text-orange-700" : step.state === "done" ? "font-semibold text-ink" : "text-ink-soft"
            }`}
          >
            {step.label}
            <span className="sr-only">
              {step.state === "done" ? " (hecho)" : step.state === "current" ? " (paso actual)" : " (pendiente)"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
