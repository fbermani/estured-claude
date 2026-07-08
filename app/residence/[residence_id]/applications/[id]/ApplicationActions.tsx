"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { REJECTION_REASONS } from "@/lib/applications/types";
import {
  markUnderReview,
  establishContact,
  rejectApplication,
  type ApplicationActionState,
} from "@/app/residence/[residence_id]/applications/actions";

const initialState: ApplicationActionState = { status: "idle" };

export function ApplicationActions({
  applicationId,
  status,
  whatsappUrl,
}: {
  applicationId: string;
  status: string;
  whatsappUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [simpleError, setSimpleError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const rejectAction = rejectApplication.bind(null, applicationId);
  const [rejectState, rejectFormAction, isRejectPending] = useActionState(rejectAction, initialState);

  function runSimpleAction(action: () => Promise<ApplicationActionState>) {
    setSimpleError(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") setSimpleError(result.message ?? "Ocurrió un error.");
    });
  }

  if (["rejected", "cancelled_by_student", "expired_no_residence_response"].includes(status)) {
    return <p className="text-sm text-ink-faint">Esta solicitud ya está cerrada.</p>;
  }

  if (status === "contact_established") {
    return (
      <div>
        <p className="text-sm font-medium text-success-fg">Ya estableciste contacto con esta solicitud.</p>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage-600"
          >
            Escribir por WhatsApp →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {simpleError && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {simpleError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "submitted" && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => runSimpleAction(() => markUnderReview(applicationId))}
          >
            Marcar en revisión
          </Button>
        )}
        <Button disabled={isPending} onClick={() => runSimpleAction(() => establishContact(applicationId))}>
          Establecer contacto
        </Button>
        <Button variant="outline" disabled={isPending} onClick={() => setShowRejectForm((v) => !v)}>
          Rechazar
        </Button>
      </div>

      {showRejectForm && (
        <form action={rejectFormAction} className="rounded-card border border-sand-200 bg-sand-50 p-4">
          <Select label="Motivo de rechazo" id="reject-reason" name="reason_code" required defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            {REJECTION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Detalle (obligatorio si elegís «Otro motivo»)"
            id="reject-text"
            name="reason_text"
            rows={2}
            className="mt-3"
          />
          {rejectState.status === "error" && (
            <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-2 text-sm font-medium text-danger-fg">
              {rejectState.message}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={isRejectPending}
            className="mt-3 border-danger-fg text-danger-fg hover:bg-danger-bg"
          >
            {isRejectPending ? "Rechazando…" : "Confirmar rechazo"}
          </Button>
        </form>
      )}
    </div>
  );
}
