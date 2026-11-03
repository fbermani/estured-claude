"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { decideFreedPlaceAction, type RoomChangeActionState } from "@/app/residence/[residence_id]/residents/roomChangeActions";
import type { PlaceAlertItem } from "@/lib/roomChange/load";
import { PLACE_ALERT_SOURCE_LABEL } from "@/lib/roomChange/rules";

const initialState: RoomChangeActionState = { status: "idle" };

export type AlertResident = { requestId: string; stayId: string; name: string; preference: string };

function SubmitButton({ label, pendingLabel, tone, disabled }: { label: string; pendingLabel: string; tone: "primary" | "outline"; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`min-h-10 cursor-pointer rounded-full border-[1.5px] px-4 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "primary" ? "border-forest bg-forest text-white hover:bg-forest-600" : "border-line text-ink-soft hover:border-forest hover:text-forest-700"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Un botón de decisión = un formulario propio (campo `decision` + `request_id` para ofrecer). */
function DecisionForm({
  residenceId,
  alertId,
  decision,
  requestId,
  label,
  pendingLabel,
  tone,
  disabled,
  title,
  onMessage,
}: {
  residenceId: string;
  alertId: string;
  decision: "offer" | "ignore" | "publish";
  requestId?: string;
  label: string;
  pendingLabel: string;
  tone: "primary" | "outline";
  disabled?: boolean;
  title?: string;
  onMessage: (message: string) => void;
}) {
  const action = async (prev: RoomChangeActionState, formData: FormData) => {
    const result = await decideFreedPlaceAction(residenceId, alertId, prev, formData);
    if (result.status === "saved" && result.message) onMessage(result.message);
    return result;
  };
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} title={title} className="flex flex-col gap-1">
      <input type="hidden" name="decision" value={decision} />
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      <SubmitButton label={label} pendingLabel={pendingLabel} tone={tone} disabled={disabled} />
      {state.status === "error" && <p role="alert" className="max-w-xs text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}

/**
 * Plazas liberadas que coinciden con un pedido de cambio de habitación (DR34). Se muestran ANTES de que la plaza se publique como
 * disponible: la residencia elige ofrecérsela a ese residente, ignorarla o publicarla. Solo aparecen cuando hay algo por decidir.
 */
export function RoomChangeAlertsCard({
  residenceId,
  alerts,
  residents,
  canDecide,
  canPublish,
  onMessage,
}: {
  residenceId: string;
  alerts: PlaceAlertItem[];
  residents: AlertResident[];
  /** `residents.manage`: ofrecer o ignorar. */
  canDecide: boolean;
  /** `operations.rooms_availability`: publicar toca la disponibilidad. */
  canPublish: boolean;
  onMessage: (message: string) => void;
}) {
  if (alerts.length === 0) return null;
  const byRequest = new Map(residents.map((r) => [r.requestId, r]));
  return (
    <section aria-label="Plazas liberadas por decidir" className="mt-6 rounded-card border-[1.5px] border-orange/50 bg-warning-bg/60 p-4 shadow-card sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Icon name="notifications_active" className="text-xl text-orange-700" />
        {alerts.length === 1 ? "Se liberó una plaza que busca alguien de tu residencia" : `Se liberaron ${alerts.length} plazas que buscan residentes`}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">Todavía no está publicada como disponible. Elegí qué hacer con cada una.</p>
      <ul className="mt-4 space-y-3">
        {alerts.map((a) => {
          const matches = a.matchingRequestIds.map((id) => byRequest.get(id)).filter((r): r is AlertResident => !!r);
          const offeredTo = a.offeredRequestId ? byRequest.get(a.offeredRequestId) : undefined;
          return (
            <li key={a.id} className="rounded-field border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-ink">{a.placeLabel}</p>
                {a.status === "offered" && <Badge tone="sage">Ofrecida</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">{PLACE_ALERT_SOURCE_LABEL[a.source]}</p>

              {a.status === "offered" ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Se la ofreciste a <b className="text-ink">{offeredTo?.name ?? "un residente"}</b>. Mientras tanto no se publica. Cuando lo reubiques
                  en esa cama, el pedido queda resuelto.
                </p>
              ) : matches.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {matches.map((m) => (
                    <li key={m.requestId} className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-cream px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{m.name}</p>
                        <p className="truncate text-xs text-ink-soft">Busca: {m.preference}</p>
                      </div>
                      <DecisionForm
                        residenceId={residenceId}
                        alertId={a.id}
                        decision="offer"
                        requestId={m.requestId}
                        label={`Ofrecérsela a ${m.name.split(" ")[0]}`}
                        pendingLabel="Ofreciendo…"
                        tone="primary"
                        disabled={!canDecide}
                        title={canDecide ? undefined : "Pedile este permiso al dueño."}
                        onMessage={onMessage}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">El pedido que coincidía ya no está pendiente.</p>
              )}

              <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
                <DecisionForm
                  residenceId={residenceId}
                  alertId={a.id}
                  decision="publish"
                  label="Publicar como disponible"
                  pendingLabel="Publicando…"
                  tone="outline"
                  disabled={!canPublish}
                  title={canPublish ? undefined : "Pedile el permiso de Habitaciones y disponibilidad al dueño."}
                  onMessage={onMessage}
                />
                <DecisionForm
                  residenceId={residenceId}
                  alertId={a.id}
                  decision="ignore"
                  label="Ignorar"
                  pendingLabel="Ignorando…"
                  tone="outline"
                  disabled={!canDecide}
                  title={canDecide ? undefined : "Pedile este permiso al dueño."}
                  onMessage={onMessage}
                />
                <Link href={`/residence/${residenceId}/availability`} className="min-h-10 self-center text-sm font-semibold text-forest-700 hover:underline">
                  Ir a Disponibilidad
                </Link>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                Ignorar no publica la plaza ni avisa a nadie: podés cargarla cuando quieras desde Disponibilidad.
                {a.deferredIncrement ? " Al publicarla, sumamos 1 a la disponibilidad del tipo." : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

