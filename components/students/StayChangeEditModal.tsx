"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import { updateStayChangeIntentAction, type StayChangeActionState } from "@/app/students/residency/stayChangeActions";
import { MAX_STUDENT_MESSAGE } from "@/lib/stayChange/validate";

const initialState: StayChangeActionState = { status: "idle" };

function todayArIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** "Editar aviso" (SPEC §13.6, opción A): fecha estimada y mensaje. Queda auditado y la residencia ve "Actualizado el…". */
export function StayChangeEditModal({
  intentId,
  residenceName,
  initialExitDate,
  initialMessage,
  editsLeft,
}: {
  intentId: string;
  residenceName: string;
  initialExitDate: string | null;
  initialMessage: string | null;
  /** Ediciones que quedan (tope del servidor); con 0 el botón se deshabilita con explicación. */
  editsLeft: number;
}) {
  const [open, setOpen] = useState(false);
  const action = updateStayChangeIntentAction.bind(null, intentId);
  const [state, formAction] = useActionState(action, initialState);
  const [message, setMessage] = useState(initialMessage ?? "");
  // Al reabrir no se arrastra el error del intento anterior.
  const [seenState, setSeenState] = useState(state);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (state.status === "saved") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSeenState(state);
          setOpen(true);
        }}
        disabled={editsLeft === 0}
        title={editsLeft === 0 ? "Ya editaste este aviso 5 veces" : undefined}
        className="inline-flex h-[46px] disabled:pointer-events-none disabled:opacity-50 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold text-ink-soft transition-colors hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:px-5"
      >
        <Icon name="edit" className="text-lg" />
        Editar aviso
      </button>
      {editsLeft === 0 && <p className="w-full text-xs text-ink-faint">Ya editaste este aviso 5 veces. Si cambió algo, cancelalo y avisá de nuevo pasadas 24 horas.</p>}
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId} describedBy={descId}>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-line px-5 py-4 sm:px-6">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              Editar tu aviso de cambio
            </h2>
            <p id={descId} className="mt-1 text-sm text-ink-soft">
              {residenceName} va a ver que actualizaste tu aviso. Tu reserva sigue igual.
            </p>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {state.status === "error" && state !== seenState && (
              <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                {state.message}
              </p>
            )}
            <Input
              label="¿Cuándo te gustaría mudarte? (opcional)"
              name="estimated_exit_date"
              type="date"
              min={initialExitDate && initialExitDate < todayArIso() ? initialExitDate : todayArIso()}
              defaultValue={initialExitDate ?? ""}
              data-autofocus
              hint="Es una estimación para que la residencia se organice."
            />
            <div>
              <Textarea
                label="Mensaje para tu residencia (opcional)"
                name="student_message"
                rows={3}
                maxLength={MAX_STUDENT_MESSAGE}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-ink-faint">
                {message.length}/{MAX_STUDENT_MESSAGE}
              </p>
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <StayChangeSubmit pendingLabel="Guardando…">Guardar cambios</StayChangeSubmit>
          </footer>
        </form>
      </Dialog>
    </>
  );
}
