"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import {
  reportResidencePaymentIssue,
  reportResidencePaymentPaid,
  type ReportPaymentState,
} from "@/app/students/applications/[id]/payment/actions";

const initialState: ReportPaymentState = { status: "idle" };

/**
 * Acciones del estudiante (o del familiar pagador de un menor) sobre el pago de la reserva (DR63 (e) y (l)).
 * Una sola acción principal: «Ya pagué» (comprobante opcional, con confirmación). «No pude realizar el pago» es secundaria
 * y abre un motivo opcional. El servidor valida quién es y en qué estado está el pago: esto es solo presentación.
 */
export function StudentPaymentActions({ applicationId, allowIssue = true }: { applicationId: string; allowIssue?: boolean }) {
  const paidAction = reportResidencePaymentPaid.bind(null, applicationId);
  const issueAction = reportResidencePaymentIssue.bind(null, applicationId);
  const [paidState, paidFormAction, isPaidPending] = useActionState(paidAction, initialState);
  const [issueState, issueFormAction, isIssuePending] = useActionState(issueAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const paidForm = useRef<HTMLFormElement>(null);
  const busy = isPaidPending || isIssuePending;

  return (
    <div className="mt-5 space-y-4">
      <form ref={paidForm} action={paidFormAction} className="space-y-3">
        <div>
          <label htmlFor="proof_file" className="text-sm font-bold text-ink-soft">
            Comprobante (opcional)
          </label>
          <input
            id="proof_file"
            name="proof_file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-700"
          />
          <p className="mt-1 text-xs text-muted">PDF, JPG, PNG o WebP, hasta 10 MB. Solo lo ve la residencia.</p>
        </div>
        {paidState.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {paidState.message}
          </p>
        )}
        <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => setConfirming(true)}>
          {isPaidPending ? "Avisando…" : "Ya pagué"}
        </Button>
      </form>

      <ConfirmDialog
        open={confirming}
        title="¿Ya hiciste el pago?"
        description="Le avisamos a la residencia, que lo tiene que confirmar. Avisá solo si el pago ya salió de tu cuenta."
        confirmLabel="Sí, ya pagué"
        cancelLabel="Todavía no"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          paidForm.current?.requestSubmit();
        }}
      />

      {!allowIssue ? null : !showIssue ? (
        <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => setShowIssue(true)}>
          No pude realizar el pago
        </Button>
      ) : (
        <form action={issueFormAction} className="space-y-3 rounded-field border border-line-2 bg-sand-50 p-4">
          <Textarea
            label="¿Qué pasó? (opcional)"
            name="reason"
            rows={3}
            maxLength={200}
            hint="Si lo escribís, que tenga al menos 10 caracteres. No pongas datos bancarios."
          />
          {issueState.status === "error" && (
            <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              {issueState.message}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              {isIssuePending ? "Avisando…" : "Avisar a la residencia"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setShowIssue(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
