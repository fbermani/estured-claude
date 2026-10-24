"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import { cancelStayChangeIntentAction, type StayChangeActionState } from "@/app/students/residency/stayChangeActions";

const initialState: StayChangeActionState = { status: "idle" };

/**
 * "¿Cancelás tu aviso de cambio?" (SPEC §3.6). Lista lo que se cierra (solicitudes y listas de espera creadas bajo el
 * aviso). Bloqueado si hay una solicitud en etapa de pago a la residencia. El foco inicial va en "Seguir buscando",
 * la acción segura.
 */
export function StayChangeCancelModal({
  intentId,
  residenceName,
  contractEndLabel,
  closableApplications,
  closableWaitlist,
  blockingApplicationIds,
  withdrawLabel = false,
  triggerLabel,
}: {
  intentId: string;
  residenceName: string;
  contractEndLabel: string;
  closableApplications: number;
  closableWaitlist: number;
  blockingApplicationIds: string[];
  /** Menor con aviso pendiente de su familiar: "Retirar aviso". */
  withdrawLabel?: boolean;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const action = cancelStayChangeIntentAction.bind(null, intentId);
  const [state, formAction] = useActionState(action, initialState);
  const titleId = useId();
  const descId = useId();
  const blockedIds = state.blockingApplicationIds?.length ? state.blockingApplicationIds : blockingApplicationIds;
  const blocked = blockedIds.length > 0;
  const total = closableApplications + closableWaitlist;

  useEffect(() => {
    if (state.status === "saved") setOpen(false);
  }, [state.status]);

  const label = triggerLabel ?? (withdrawLabel ? "Retirar aviso" : "Cancelar aviso");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[46px] items-center justify-center gap-2 rounded-full px-3 text-sm font-bold text-danger-fg sm:px-5 transition-colors hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="close" className="text-lg" />
        {label}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} describedBy={descId}>
        {blocked ? (
          <>
            <header className="border-b border-line px-5 py-4 sm:px-6">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                Todavía no podés cancelar tu aviso
              </h2>
              <p id={descId} className="mt-1 text-sm leading-relaxed text-ink-soft">
                Tenés una solicitud en etapa de pago a la residencia que se envió por tu cambio. Cerrala primero para no quedar con dos reservas que se
                superponen. Si necesitás ayuda, escribí a Soporte.
              </p>
            </header>
            <div className="space-y-2 px-5 py-4 sm:px-6">
              {blockedIds.map((id) => (
                <Link
                  key={id}
                  href={`/students/applications/${id}`}
                  className="flex items-center justify-between gap-3 rounded-field border-[1.5px] border-line px-4 py-3 text-sm font-bold text-forest-700 hover:border-forest hover:bg-forest-tint"
                >
                  <span className="flex items-center gap-2">
                    <Icon name="description" className="text-lg" /> Solicitud en etapa de pago
                  </span>
                  <span>Ver solicitud</span>
                </Link>
              ))}
            </div>
            <footer className="flex justify-end border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <Button type="button" size="sm" onClick={() => setOpen(false)} data-autofocus>
                Entendido
              </Button>
            </footer>
          </>
        ) : (
          <form action={formAction} className="flex min-h-0 flex-1 flex-col">
            <header className="border-b border-line px-5 py-4 sm:px-6">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                {withdrawLabel ? "¿Retirás tu aviso de cambio?" : "¿Cancelás tu aviso de cambio?"}
              </h2>
              <p id={descId} className="mt-1 text-sm leading-relaxed text-ink-soft">
                {withdrawLabel
                  ? `Todavía no se lo enviamos a ${residenceName}. Tu reserva sigue igual.`
                  : `Le avisamos a ${residenceName} que dejaste de buscar. Tu reserva sigue igual y vuelve el límite de fechas: solo vas a poder solicitar para después del ${contractEndLabel}.`}
              </p>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {state.status === "error" && (
                <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                  {state.message}
                </p>
              )}
              {!withdrawLabel && (
                <div>
                  <p className="text-sm font-bold text-ink">Esto se cierra al cancelar:</p>
                  {total === 0 ? (
                    <p className="mt-2 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">No tenés solicitudes ni listas de espera por tu cambio.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {closableApplications > 0 && (
                        <li className="flex items-center gap-3 rounded-field border border-line px-4 py-3 text-sm text-ink">
                          <Icon name="description" className="text-lg text-ink-faint" />
                          <span>
                            {closableApplications} {closableApplications === 1 ? "solicitud" : "solicitudes"} <span className="font-bold text-danger-fg">· {closableApplications === 1 ? "se cancela" : "se cancelan"}</span>
                          </span>
                        </li>
                      )}
                      {closableWaitlist > 0 && (
                        <li className="flex items-center gap-3 rounded-field border border-line px-4 py-3 text-sm text-ink">
                          <Icon name="hourglass_top" className="text-lg text-ink-faint" />
                          <span>
                            {closableWaitlist} {closableWaitlist === 1 ? "lista de espera" : "listas de espera"}{" "}
                            <span className="font-bold text-danger-fg">· salís de {closableWaitlist === 1 ? "la lista" : "las listas"}</span>
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                  {total > 0 && <p className="mt-2 text-xs text-ink-soft">Avisamos a esas residencias que ya no seguís.</p>}
                </div>
              )}
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} data-autofocus>
                Seguir buscando
              </Button>
              <StayChangeSubmit pendingLabel="Cancelando…" danger>
                {withdrawLabel ? "Retirar aviso" : total > 0 ? `Cancelar aviso y cerrar ${total}` : "Cancelar aviso"}
              </StayChangeSubmit>
            </footer>
          </form>
        )}
      </Dialog>
    </>
  );
}
