"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cancelRoomChangeRequestAction, createRoomChangeRequestAction, type StudentRoomChangeState } from "@/app/students/residency/roomChangeActions";
import type { StudentRoomChangeView } from "@/lib/roomChange/load";
import {
  describePreference,
  isOpenRoomChangeStatus,
  ROOM_CHANGE_COSTS_NOTICE,
  ROOM_CHANGE_GENDERS,
  ROOM_CHANGE_GENDER_LABEL,
  ROOM_CHANGE_NOTE_MAX,
  ROOM_CHANGE_REASON_MAX,
  ROOM_CHANGE_STATUS_LABEL,
} from "@/lib/roomChange/rules";
import { Input, Select, Textarea } from "@/components/ui/Input";

const initialState: StudentRoomChangeState = { status: "idle" };

const STATUS_TONE: Record<string, "amber" | "sage" | "neutral"> = { pending: "amber", offered: "sage", resolved: "neutral", cancelled: "neutral" };

const STATUS_HINT: Record<string, string> = {
  pending: "Tu residencia lo ve en Residentes. Si se libera una plaza que coincide, te puede ofrecer el cambio.",
  offered: "Tu residencia lo está gestionando. Coordiná con ella los pasos y los costos.",
};

const COSTS_CHECKBOX_REQUIRED = "Marcá la casilla para poder enviar el pedido.";

function RequestForm({ view, onDone }: { view: StudentRoomChangeView; onDone: () => void }) {
  const action = async (prev: StudentRoomChangeState, formData: FormData) => {
    const result = await createRoomChangeRequestAction(prev, formData);
    if (result.status === "saved") onDone();
    return result;
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  // Se envía con onSubmit (y no con `action={formAction}`): React 19 resetea el formulario al terminar la acción y, si el server devuelve un error,
  // se perdería lo escrito (y la casilla controlada se desincroniza). Los campos son controlados por el mismo motivo.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }
  const [roomTypeId, setRoomTypeId] = useState("");
  const [gender, setGender] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmCosts, setConfirmCosts] = useState(false);
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Tipo de habitación" name="room_type_id" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} keepLabelUp>
          <option value="">Cualquiera</option>
          {view.roomTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.name === view.currentTypeName ? " (la que tenés)" : ""}
            </option>
          ))}
        </Select>
        <Select label="Género de la habitación" name="gender" value={gender} onChange={(e) => setGender(e.target.value)} keepLabelUp>
          <option value="">Cualquiera</option>
          {ROOM_CHANGE_GENDERS.map((g) => (
            <option key={g} value={g}>
              {ROOM_CHANGE_GENDER_LABEL[g]}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Piso o nota (opcional)"
        name="note"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={ROOM_CHANGE_NOTE_MAX}
        placeholder="Ej.: un piso más alto, lejos de la calle"
      />
      <Textarea
        label="Motivo (opcional)"
        hint="Contale a tu residencia por qué querés el cambio."
        name="reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={ROOM_CHANGE_REASON_MAX}
      />
      <p className="text-xs text-ink-faint">Elegí al menos un tipo de habitación, un género o una nota: el motivo solo no alcanza. Lo que dejes vacío te da igual.</p>
      <label className="flex items-start gap-2.5 rounded-field bg-warning-bg px-3.5 py-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="confirm_costs"
          required
          checked={confirmCosts}
          onChange={(e) => {
            e.currentTarget.setCustomValidity("");
            setConfirmCosts(e.target.checked);
          }}
          onInvalid={(e) => e.currentTarget.setCustomValidity(COSTS_CHECKBOX_REQUIRED)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>{ROOM_CHANGE_COSTS_NOTICE}</span>
      </label>
      {state.status === "error" && !pending && <p role="alert" className="rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-600 disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar pedido a mi residencia"}
      </button>
    </form>
  );
}

function CancelRequest({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const action = async (prev: StudentRoomChangeState) => {
    const result = await cancelRoomChangeRequestAction(requestId, prev);
    if (result.status === "saved") onDone();
    return result;
  };
  const [state, formAction, pending] = useActionState(action, initialState);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-line px-5 text-sm font-bold text-ink-soft hover:border-danger-fg hover:text-danger-fg"
      >
        Cancelar pedido
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-soft">¿Cancelás tu pedido de cambio?</span>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-full bg-danger-fg px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Cancelando…" : "Sí, cancelar"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-ink-soft hover:text-ink">
        No
      </button>
      {state.status === "error" && <p role="alert" className="basis-full text-sm font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}

/**
 * «Cambio de habitación» en Mi residencia (DR34). El estudiante pide otra habitación DENTRO de su residencia, con una preferencia (tipo,
 * género, piso / nota) y un motivo. Siempre sujeto a disponibilidad y a los costos que correspondan: acá no se cobra nada, solo queda constancia
 * del texto que reconoció. Estados: pendiente → en gestión → resuelta / cancelada (puede cancelar mientras siga abierto).
 */
export function RoomChangeCard({ view }: { view: StudentRoomChangeView }) {
  const [showForm, setShowForm] = useState(false);
  const [sent, setSent] = useState(false);
  const request = view.request;
  const open = request ? isOpenRoomChangeStatus(request.status) : false;
  const blockedMinor = view.isMinor && !view.hasFamily;

  return (
    <Card id="cambio-habitacion" className="scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-tint text-forest-700">
          <Icon name="meeting_room" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">Cambio de habitación</h2>
          <p className="text-sm text-ink-soft">Pedí otra habitación dentro de {view.residenceName}.</p>
        </div>
        {request && <Badge tone={STATUS_TONE[request.status] ?? "neutral"}>{ROOM_CHANGE_STATUS_LABEL[request.status]}</Badge>}
      </div>

      {request && open ? (
        <div className="mt-4">
          {sent && (
            <p role="status" className="mb-3 flex items-start gap-2 rounded-field bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success-fg">
              <Icon name="check_circle" className="mt-0.5 text-lg" /> Le mandamos tu pedido a tu residencia. Queda sujeto a disponibilidad.
            </p>
          )}
          <p className="text-sm font-semibold text-ink">
            Buscás: {describePreference({ typeName: request.roomTypeName, gender: request.gender, note: request.note })}
          </p>
          {request.reason && <p className="mt-1 text-sm text-ink-soft">“{request.reason}”</p>}
          {request.offeredLabel && (
            <p className="mt-3 flex items-start gap-2 rounded-field bg-forest-tint px-3.5 py-3 text-sm text-forest-700">
              <Icon name="key" className="mt-0.5 text-lg" />
              <span>
                Tu residencia te ofrece: <b>{request.offeredLabel}</b>. Sigue sujeto a disponibilidad y a los costos que correspondan, que te informa la residencia.
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-ink-faint">{STATUS_HINT[request.status]} Sujeto a disponibilidad y a los costos que correspondan.</p>
          <div className="mt-4">
            <CancelRequest requestId={request.id} onDone={() => setSent(false)} />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {request && (
            <p className="mb-3 text-xs text-ink-faint">
              Tu último pedido está {request.status === "resolved" ? "resuelto" : "cancelado"}
              {request.closedReason === "moved" ? ": ya te cambiaron de habitación" : ""}.
            </p>
          )}
          {blockedMinor ? (
            <p className="text-sm text-ink-soft">Como sos menor de edad, necesitás un familiar vinculado para pedir un cambio de habitación.</p>
          ) : !showForm ? (
            <>
              <p className="text-sm text-ink-soft">Contanos qué buscás y se lo avisamos a tu residencia. Sujeto a disponibilidad, asumiendo los costos que correspondan.</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 min-h-11 cursor-pointer rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-600"
              >
                Pedir cambio de habitación
              </button>
            </>
          ) : (
            <RequestForm
              view={view}
              onDone={() => setSent(true)}
            />
          )}
        </div>
      )}
    </Card>
  );
}
