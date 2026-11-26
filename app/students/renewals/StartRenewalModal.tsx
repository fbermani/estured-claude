"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { requestRenewalAction, type RenewalFormState } from "@/app/students/renewals/actions";

const initialState: RenewalFormState = { status: "idle" };
const DURATION_OPTIONS = [1, 3, 6, 12];

function defaultDuration(minimumStayMonths: number | null): number {
  return minimumStayMonths ?? 6;
}

/**
 * Modal de "Iniciar renovación" (Ciclo 39, ref. diseño
 * estured_mi_residencia_dashboard_view_2) — pedido del dueño para
 * reemplazar el link llano a /students/renewals por un modal real
 * desde Mi residencia. A diferencia de la referencia (que mostraba un
 * desglose de "Fee EstuRED" y checkboxes de aceptar pago), este modal
 * solo cubre la solicitud INFORMAL (`renewal_requests`, sin oferta
 * todavía) — la residencia es quien fija el precio final y el fee real
 * se paga recién cuando llega su oferta (`renewal_offers`). Cobrar o
 * prometer un monto acá violaría "nunca prometer disponibilidad ni
 * garantías" (CLAUDE.md regla 3) sobre algo que todavía no existe. El
 * total mostrado es una estimación a tarifa actual, marcada como tal.
 * Reusa `requestRenewalAction` sin tocar la lógica de servidor.
 */
export function StartRenewalModal({
  reservationId,
  roomTypeName,
  currentEndDateLabel,
  monthlyPriceUsd,
  minimumStayMonths,
  triggerLabel = "Iniciar renovación",
  triggerVariant = "primary",
  triggerSize = "sm",
  triggerClassName = "",
}: {
  reservationId: string;
  roomTypeName: string | null;
  currentEndDateLabel: string;
  monthlyPriceUsd: number | null;
  minimumStayMonths: number | null;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost";
  triggerSize?: "sm" | "md" | "lg";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(() => defaultDuration(minimumStayMonths));
  const [customDuration, setCustomDuration] = useState(() => !DURATION_OPTIONS.includes(defaultDuration(minimumStayMonths)));

  const action = requestRenewalAction.bind(null, reservationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const estimatedTotal = monthlyPriceUsd && duration > 0 ? monthlyPriceUsd * duration : null;
  const meetsMinimum = !minimumStayMonths || duration >= minimumStayMonths;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="start-renewal-title" className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <div className="animate-dialog-backdrop fixed inset-0 bg-forest-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />

          <div className="animate-dialog-center relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] sm:max-h-[90vh] sm:rounded-card bg-paper shadow-float">
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <h2 id="start-renewal-title" className="text-lg font-bold text-ink">
                  Iniciar renovación
                </h2>
                <p className="text-sm text-ink-soft">Renová con tiempo y evitá apuros cerca del fin de tu contrato.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-ink-faint hover:bg-cream-2"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            {state.status === "saved" ? (
              <div className="p-6">
                <p className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
                  Solicitud enviada — te avisamos cuando la residencia responda.
                </p>
                <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </div>
            ) : (
              <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                  <div className="rounded-field border border-line-2 bg-cream-2 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-ink">Tu estadía actual</h3>
                      <span className="rounded-full bg-forest-tint px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-forest-700">
                        Alojado
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase text-ink-faint">Habitación</p>
                        <p className="font-medium text-ink">{roomTypeName ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-ink-faint">Fin de contrato</p>
                        <p className="font-medium text-ink">{currentEndDateLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-ink-faint">Tarifa actual</p>
                        <p className="font-medium text-ink">{monthlyPriceUsd ? `USD ${monthlyPriceUsd}/mes` : "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-ink">Elegí cuánto querés renovar</h3>
                      {minimumStayMonths != null && (
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                            meetsMinimum ? "bg-forest-tint text-forest-700" : "bg-warning-bg text-warning-fg"
                          }`}
                        >
                          {meetsMinimum ? "Mínimo cumplido" : `Mínimo ${minimumStayMonths} meses`}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DURATION_OPTIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setDuration(m);
                            setCustomDuration(false);
                          }}
                          className={`min-w-[64px] flex-1 rounded-field border-[1.5px] px-3 py-2 text-sm font-semibold transition-colors ${
                            !customDuration && duration === m
                              ? "border-forest bg-forest-tint text-forest-700"
                              : "border-line text-ink-soft hover:border-forest-600 hover:text-forest-700"
                          }`}
                        >
                          {m} {m === 1 ? "mes" : "meses"}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCustomDuration(true)}
                        className={`min-w-[64px] flex-1 rounded-field border-[1.5px] px-3 py-2 text-sm font-semibold transition-colors ${
                          customDuration
                            ? "border-forest bg-forest-tint text-forest-700"
                            : "border-line text-ink-soft hover:border-forest-600 hover:text-forest-700"
                        }`}
                      >
                        Otro
                      </button>
                    </div>
                    {customDuration && (
                      <input
                        type="number"
                        inputMode="numeric"
                        enterKeyHint="done"
                        min={1}
                        max={24}
                        value={duration}
                        onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                        aria-label="Duración personalizada en meses"
                        className="w-28 rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink"
                      />
                    )}
                    <input type="hidden" name="desired_duration_months" value={duration} />
                  </div>

                  {estimatedTotal != null && (
                    <div className="rounded-field border border-line bg-paper p-4">
                      <div className="flex items-center justify-between text-sm text-ink-soft">
                        <span>
                          Total estimado del período ({duration} {duration === 1 ? "mes" : "meses"})
                        </span>
                        <span className="font-bold text-ink">USD {estimatedTotal.toLocaleString("es-AR")}</span>
                      </div>
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
                        <Icon name="info" className="mt-0.5 shrink-0 text-sm" />
                        Estimado a la tarifa actual — la residencia puede confirmarte un valor distinto en su oferta
                        de renovación.
                      </p>
                    </div>
                  )}

                  <Textarea
                    label="Mensaje para la residencia (opcional)"
                    name="message"
                    rows={2}
                    placeholder="Ej: quisiera renovar por 6 meses más si es posible."
                  />

                  {state.status === "error" && (
                    <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                      {state.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-line bg-cream-2 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Enviando…" : "Enviar solicitud de renovación"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
