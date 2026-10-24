"use client";

import { useActionState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import {
  confirmStayChangeIntentByFamilyAction,
  confirmStillSearchingAction,
  markStayChangeResponseSeenAction,
  saveStayExitStudentNoteAction,
  type StayChangeActionState,
} from "@/app/students/residency/stayChangeActions";
import { Textarea } from "@/components/ui/Input";

const initialState: StayChangeActionState = { status: "idle" };

function Feedback({ state }: { state: StayChangeActionState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
        {state.message}
      </p>
    );
  }
  if (state.status === "saved") {
    return (
      <p role="status" className="mt-2 text-xs font-medium text-success-fg">
        {state.message}
      </p>
    );
  }
  return null;
}

/** "Seguir buscando" (recordatorio de vencimiento): extiende el aviso 90 días. */
export function KeepSearchingButton({ intentId }: { intentId: string }) {
  const action = confirmStillSearchingAction.bind(null, intentId);
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction}>
      <StayChangeSubmit pendingLabel="Guardando…" variant="primary">
        Seguir buscando
      </StayChangeSubmit>
      <Feedback state={state} />
    </form>
  );
}

/** Menor: el familiar vinculado confirma el aviso (solo lectura del mensaje privado: no se muestra). */
export function ConfirmByFamilyButton({ intentId }: { intentId: string }) {
  const action = confirmStayChangeIntentByFamilyAction.bind(null, intentId);
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction}>
      <StayChangeSubmit pendingLabel="Confirmando…" variant="primary">
        <Icon name="check_circle" className="text-lg" />
        Confirmar aviso
      </StayChangeSubmit>
      <Feedback state={state} />
    </form>
  );
}

/** Registra que el estudiante vio la respuesta de la residencia (efecto secundario, una vez por montaje). */
export function ResponseSeenMarker({ intentId, alreadySeen }: { intentId: string; alreadySeen: boolean }) {
  useEffect(() => {
    if (alreadySeen) return;
    void markStayChangeResponseSeenAction(intentId);
  }, [intentId, alreadySeen]);
  return null;
}

/** Nota opcional del estudiante sobre su salida anticipada (después de que la residencia la registró). */
export function ExitStudentNoteForm({ residentStayId, initialNote }: { residentStayId: string; initialNote: string | null }) {
  const action = saveStayExitStudentNoteAction.bind(null, residentStayId);
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction}>
      <Textarea
        label="Tu nota (opcional)"
        name="student_note"
        rows={3}
        maxLength={1000}
        defaultValue={initialNote ?? ""}
        hint="Queda registrada junto a la salida. La residencia puede leerla."
      />
      <div className="mt-3">
        <StayChangeSubmit pendingLabel="Guardando…" variant="outline">
          {initialNote ? "Actualizar nota" : "Guardar nota"}
        </StayChangeSubmit>
      </div>
      <Feedback state={state} />
    </form>
  );
}
