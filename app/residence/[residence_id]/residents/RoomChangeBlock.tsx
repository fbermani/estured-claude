"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import {
  saveRoomChangeRequestAction,
  updateRoomChangeStatusAction,
  type RoomChangeActionState,
} from "@/app/residence/[residence_id]/residents/roomChangeActions";
import type { ResidenceRoomChangeItem } from "@/lib/roomChange/load";
import {
  describePreference,
  isOpenRoomChangeStatus,
  ROOM_CHANGE_GENDERS,
  ROOM_CHANGE_GENDER_LABEL,
  ROOM_CHANGE_NOTE_MAX,
  ROOM_CHANGE_REASON_MAX,
  ROOM_CHANGE_STATUS_LABEL,
} from "@/lib/roomChange/rules";

const initialState: RoomChangeActionState = { status: "idle" };

const fieldClass =
  "w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none";

const STATUS_TONE: Record<string, "amber" | "sage" | "neutral"> = { pending: "amber", offered: "sage", resolved: "neutral", cancelled: "neutral" };

/** Botón de envío con `name`/`value` nativos (varios intents en un mismo formulario, sin `onClick` + `setState`). */
function IntentButton({
  name,
  value,
  label,
  pendingLabel,
  tone = "outline",
}: {
  name: string;
  value: string;
  label: string;
  pendingLabel: string;
  tone?: "outline" | "primary" | "danger";
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get(name) === value;
  const toneClass =
    tone === "primary"
      ? "border-forest bg-forest text-white hover:bg-forest-600"
      : tone === "danger"
        ? "border-line text-danger-fg hover:border-danger-fg"
        : "border-line text-ink-soft hover:border-forest hover:text-forest-700";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`min-h-9 cursor-pointer rounded-full border-[1.5px] px-3.5 py-1 text-xs font-bold disabled:opacity-50 ${toneClass}`}
    >
      {mine ? pendingLabel : label}
    </button>
  );
}

function PreferenceForm({
  residenceId,
  stayId,
  roomTypes,
  request,
  onDone,
  onCancel,
}: {
  residenceId: string;
  stayId: string;
  roomTypes: { id: string; name: string }[];
  request: ResidenceRoomChangeItem | null;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const action = async (prev: RoomChangeActionState, formData: FormData) => {
    const result = await saveRoomChangeRequestAction(residenceId, stayId, prev, formData);
    if (result.status === "saved") onDone(result.message ?? "Guardado.");
    return result;
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink-soft">
          Tipo de habitación
          <select name="room_type_id" defaultValue={request?.roomTypeId ?? ""} className={`mt-1 ${fieldClass}`}>
            <option value="">Cualquiera</option>
            {roomTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-soft">
          Género de la habitación
          <select name="gender" defaultValue={request?.gender ?? ""} className={`mt-1 ${fieldClass}`}>
            <option value="">Cualquiera</option>
            {ROOM_CHANGE_GENDERS.map((g) => (
              <option key={g} value={g}>
                {ROOM_CHANGE_GENDER_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-semibold text-ink-soft">
        Piso o nota (opcional)
        <input
          name="note"
          type="text"
          maxLength={ROOM_CHANGE_NOTE_MAX}
          defaultValue={request?.note ?? ""}
          placeholder="Ej.: un piso más alto, cerca del patio"
          className={`mt-1 ${fieldClass}`}
        />
      </label>
      <label className="block text-xs font-semibold text-ink-soft">
        Motivo (opcional)
        <textarea name="reason" rows={2} maxLength={ROOM_CHANGE_REASON_MAX} defaultValue={request?.reason ?? ""} className={`mt-1 ${fieldClass}`} />
      </label>
      <p className="text-xs text-ink-faint">Sujeto a disponibilidad. Dejá vacío lo que le dé igual al residente: con una sola preferencia alcanza.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 cursor-pointer rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-white hover:bg-forest-600 disabled:opacity-50"
        >
          {pending ? "Guardando…" : request ? "Guardar preferencia" : "Anotar el pedido"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-9 cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
      {state.status === "error" && <p role="alert" className="text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}

/**
 * «Cambio de habitación» dentro de «Habitación y cama» de la ficha del residente (DR34). Opción «Solicita cambio de habitación» + la
 * preferencia (tipo, género, piso / nota libre), que además sirve de filtro en la lista de residentes. Estados: pendiente → en gestión →
 * resuelta / cancelada. No cobra nada ni promete disponibilidad.
 */
export function RoomChangeBlock({
  residenceId,
  stayId,
  request,
  roomTypes,
}: {
  residenceId: string;
  stayId: string;
  request: ResidenceRoomChangeItem | null;
  roomTypes: { id: string; name: string }[];
}) {
  const open = request ? isOpenRoomChangeStatus(request.status) : false;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const statusAction = request ? updateRoomChangeStatusAction.bind(null, residenceId, request.id) : null;
  const [statusState, statusFormAction] = useActionState(statusAction ?? (async () => initialState), initialState);

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-muted">
        <Icon name="swap_horiz" className="text-sm" /> Cambio de habitación
      </p>

      {request && open ? (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[request.status] ?? "neutral"}>{ROOM_CHANGE_STATUS_LABEL[request.status]}</Badge>
            <span className="text-xs text-ink-faint">{request.origin === "student" ? "Lo pidió el residente" : "Lo anotó la residencia"}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">
            {describePreference({ typeName: request.roomTypeName, gender: request.gender, note: request.note })}
          </p>
          {request.reason && <p className="mt-1 text-sm text-ink-soft">“{request.reason}”</p>}
          {request.offeredLabel && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-forest-700">
              <Icon name="key" className="mt-0.5 text-base" /> Plaza ofrecida: {request.offeredLabel}
            </p>
          )}
          {!editing ? (
            <form action={statusFormAction} className="mt-3 flex flex-wrap gap-2">
              {request.status === "pending" ? (
                <IntentButton name="to" value="offered" label="Pasar a en gestión" pendingLabel="Guardando…" />
              ) : (
                <IntentButton name="to" value="pending" label="Volver a pendiente" pendingLabel="Guardando…" />
              )}
              <IntentButton name="to" value="resolved" label="Marcar resuelta" pendingLabel="Guardando…" tone="primary" />
              <IntentButton name="to" value="cancelled" label="Cancelar pedido" pendingLabel="Cancelando…" tone="danger" />
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-9 cursor-pointer rounded-full px-3 py-1 text-xs font-bold text-forest-700 hover:underline"
              >
                Editar preferencia
              </button>
            </form>
          ) : (
            <PreferenceForm
              residenceId={residenceId}
              stayId={stayId}
              roomTypes={roomTypes}
              request={request}
              onDone={(m) => {
                setEditing(false);
                setToast(m);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {statusState.status === "error" && <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">{statusState.message}</p>}
          {statusState.status === "saved" && statusState.message && <p role="status" className="mt-2 text-xs font-medium text-success-fg">{statusState.message}</p>}
        </div>
      ) : (
        <div>
          {request && (
            <p className="mb-2 text-xs text-ink-faint">
              Último pedido: {ROOM_CHANGE_STATUS_LABEL[request.status].toLowerCase()} ·{" "}
              {describePreference({ typeName: request.roomTypeName, gender: request.gender, note: request.note })}
            </p>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={adding}
            onClick={() => setAdding((v) => !v)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line px-3.5 py-1 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700"
          >
            <span aria-hidden className={`flex h-4 w-7 items-center rounded-full px-0.5 transition-colors ${adding ? "bg-forest" : "bg-line-2"}`}>
              <span className={`h-3 w-3 rounded-full bg-white transition-transform ${adding ? "translate-x-3" : ""}`} />
            </span>
            Solicita cambio de habitación
          </button>
          {adding && (
            <PreferenceForm
              residenceId={residenceId}
              stayId={stayId}
              roomTypes={roomTypes}
              request={null}
              onDone={(m) => {
                setAdding(false);
                setToast(m);
              }}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      )}
      {toast && <p role="status" className="mt-2 text-xs font-medium text-success-fg">{toast}</p>}
    </div>
  );
}
