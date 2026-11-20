"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import type { CompletionRow, CompletionState } from "@/lib/residences/completionPanel";

const STATE_VIEW: Record<CompletionState, { icon: string; label: string; tone: string }> = {
  done: { icon: "check_circle", label: "Hecho", tone: "text-success-fg" },
  todo: { icon: "pending", label: "Pendiente", tone: "text-warning-fg" },
  ready: { icon: "share", label: "Disponible", tone: "text-forest-700" },
  locked: { icon: "lock_clock", label: "Se activa al publicar", tone: "text-ink-soft" },
};

/**
 * «Completá tu ficha»: aparece tras guardar o enviar la configuración, solo si falta algo, y se cierra con Esc, el fondo o «Ahora no».
 * No bloquea nada: ofrece tres enlaces (reglamento, preguntas, compartir) con su estado real. Las filas salen de `buildCompletionPanel`.
 */
export function CompleteFichaDialog({
  open,
  onClose,
  residenceId,
  variant,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  residenceId: string;
  variant: "saved" | "submitted";
  rows: CompletionRow[];
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} describedBy={descId} maxWidthClass="sm:max-w-lg">
      <div className="overflow-y-auto px-5 py-5 sm:px-6">
        <h2 id={titleId} className="text-lg font-bold text-ink">
          Completá tu ficha
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-ink-soft">
          {variant === "submitted"
            ? "Enviamos tu residencia a revisión. Mientras el equipo de EstuRed la revisa, podés dejar listo esto:"
            : "Guardamos tus cambios. Para que tu ficha quede completa, mirá estos pasos:"}
        </p>
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const view = STATE_VIEW[row.state];
            return (
              <li key={row.key} className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="font-bold text-ink">{row.label}</p>
                  <p className={`flex items-center gap-1 text-xs font-bold ${view.tone}`}>
                    <Icon name={view.icon} className="text-base" />
                    {view.label}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{row.detail}</p>
                <p className="mt-0.5 text-xs text-ink-faint">{row.reason}</p>
                {row.href && row.cta && (
                  <a
                    href={`/residence/${residenceId}/${row.href}`}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    {row.cta}
                    <Icon name="arrow_forward" className="text-base" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex justify-end border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <Button type="button" variant="outline" size="sm" onClick={onClose} data-autofocus>
          Ahora no
        </Button>
      </div>
    </Dialog>
  );
}
