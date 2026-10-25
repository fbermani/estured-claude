"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { acceptRegulationAction, type AcceptRegulationState } from "@/app/students/applications/actions";

const initialState: AcceptRegulationState = { status: "idle" };

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Leí y acepto"}
    </Button>
  );
}

/**
 * Aceptación posterior del reglamento (DR14) sobre una solicitud que nació sin ella. El texto completo va ya renderizado desde el servidor;
 * el botón «Leí y acepto» envía la versión que se mostró (hash) para que el servidor valide que sigue siendo la vigente.
 */
export function AcceptRegulationForm({ applicationId, hash, content }: { applicationId: string; hash: string; content: ReactNode }) {
  const action = acceptRegulationAction.bind(null, applicationId);
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="regulation_hash" value={hash} />
      <input type="hidden" name="accept_regulation" value="on" />
      <details className="rounded-field border border-line-2 bg-paper p-4">
        <summary className="cursor-pointer text-sm font-bold text-forest-700">Leer el reglamento completo</summary>
        <div className="mt-3">{content}</div>
      </details>
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {state.message}
        </p>
      )}
      <AcceptButton />
      <p className="text-xs text-ink-faint">Aceptar el reglamento no asegura el lugar: la solicitud sigue sujeta a confirmación de la residencia.</p>
    </form>
  );
}
