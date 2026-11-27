"use client";

import { useState } from "react";
import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { updateSupportCaseStatusAction, type UpdateCaseActionState } from "@/app/admin/support-cases/actions";
import { Select, Textarea } from "@/components/ui/Input";

const initialState: UpdateCaseActionState = { status: "idle" };

const STATUS_OPTIONS = [
  { value: "opened", label: "Abierto" },
  { value: "submitted", label: "Enviado" },
  { value: "under_review", label: "En revisión" },
  { value: "needs_more_info", label: "Necesitamos más info" },
  { value: "waiting_other_party", label: "Esperando a la otra parte" },
  { value: "in_progress", label: "En curso" },
  { value: "resolved_by_agreement", label: "Resuelto por acuerdo (cierra)" },
  { value: "closed_no_action", label: "Cerrado sin acción (cierra)" },
  { value: "closed_unresolved", label: "Cerrado sin resolución (cierra)" },
  { value: "admin_action_taken", label: "EstuRed tomó una acción (cierra)" },
];
const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];
const OUTCOME_OPTIONS = [
  { value: "closed_no_action", label: "Cierre sin acción" },
  { value: "warning", label: "Advertencia" },
  { value: "agreement_between_parties", label: "Acuerdo entre partes" },
  { value: "estured_fee_refund", label: "Reembolso del fee EstuRed" },
  { value: "alternative_recommended", label: "Recomendación de alternativa" },
  { value: "visibility_penalty", label: "Penalización de visibilidad" },
  { value: "suspension", label: "Suspensión" },
  { value: "expulsion", label: "Expulsión" },
];

export function UpdateCaseForm({ supportCaseId, currentStatus }: { supportCaseId: string; currentStatus: string }) {
  const action = updateSupportCaseStatusAction.bind(null, supportCaseId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [status, setStatus] = useState(currentStatus);
  const isClosing = CLOSED_STATUSES.includes(status);

  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-lg p-4" style={{ border: `1.5px solid ${cmd.border}` }}>
      <div>
        <Select label="Estado" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {isClosing && (
        <div>
          <Select label="Resultado" name="outcome" required defaultValue="">
            <option value="" disabled>
              Elegí un resultado
            </option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
            Esto es solo un registro — para reembolsar el fee, pausar la residencia o bloquear un usuario, usá esas
            pantallas directamente.
          </p>
        </div>
      )}

      <div>
        <Textarea
          label={isClosing ? "Notas (obligatorio al cerrar)" : "Notas"}
          hint="Se comparte con quien abrió el caso si lo cerrás."
          name="notes"
          rows={3}
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="text-sm font-medium" style={{ color: cmd.emerald }}>
          {state.message}
        </p>
      )}

      <AdminButton type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Guardando…" : "Actualizar caso"}
      </AdminButton>
    </form>
  );
}
