"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  respondFamilyProposal,
  type RespondFamilyProposalState,
} from "@/app/students/family-proposals/actions";

const initialState: RespondFamilyProposalState = { status: "idle" };

export function FamilyProposalActions({ proposalId }: { proposalId: string }) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [confirmed, setConfirmed] = useState(false);

  const approveAction = respondFamilyProposal.bind(null, proposalId, "approve");
  const [approveState, approveFormAction, isApprovePending] = useActionState(approveAction, initialState);

  const rejectAction = respondFamilyProposal.bind(null, proposalId, "reject");
  const [rejectState, rejectFormAction, isRejectPending] = useActionState(rejectAction, initialState);

  if (mode === "approve") {
    return (
      <form action={approveFormAction} className="mt-4 rounded-card border border-sand-200 bg-sand-50 p-4">
        <p className="text-sm font-medium text-ink">
          Al aprobar, se crea una solicitud real y la residencia va a contactar a tu familiar (no a vos),
          ya que él/ella la inició. Queda sujeta a las mismas reglas que cualquier otra solicitud.
        </p>
        <Textarea
          label="¿Cuál es tu objetivo académico?"
          name="academic_objective"
          rows={3}
          placeholder="Ej: Iniciar mi carrera universitaria en CABA durante el ciclo lectivo actual."
          hint="Obligatorio — se usa para tu comprobante de reserva."
          className="mt-3"
          required
        />
        {approveState.status === "error" && (
          <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-2 text-sm font-medium text-danger-fg">
            {approveState.message}
          </p>
        )}
        <label className="mt-3 flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-petrol-600"
          />
          Entiendo que se va a generar una solicitud real y acepto continuar.
        </label>
        <div className="mt-3 flex gap-3">
          <Button type="button" variant="outline" onClick={() => setMode("idle")} disabled={isApprovePending}>
            Volver
          </Button>
          <Button type="submit" disabled={!confirmed || isApprovePending}>
            {isApprovePending ? "Confirmando…" : "Confirmar aprobación"}
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "reject") {
    return (
      <form action={rejectFormAction} className="mt-4 rounded-card border border-sand-200 bg-sand-50 p-4">
        <Textarea
          label="¿Por qué la rechazás? (opcional)"
          name="reason"
          rows={2}
          placeholder="Ej: Prefiero buscar algo más cerca de mi facultad."
        />
        {rejectState.status === "error" && (
          <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-2 text-sm font-medium text-danger-fg">
            {rejectState.message}
          </p>
        )}
        <div className="mt-3 flex gap-3">
          <Button type="button" variant="outline" onClick={() => setMode("idle")} disabled={isRejectPending}>
            Volver
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isRejectPending}
            className="border-danger-fg text-danger-fg hover:bg-danger-bg"
          >
            {isRejectPending ? "Rechazando…" : "Confirmar rechazo"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => setMode("reject")}>
        Rechazar
      </Button>
      <Button onClick={() => setMode("approve")}>Aprobar</Button>
    </div>
  );
}
