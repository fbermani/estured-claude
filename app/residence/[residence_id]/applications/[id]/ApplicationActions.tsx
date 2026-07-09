"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, Input } from "@/components/ui/Input";
import { REJECTION_REASONS } from "@/lib/applications/types";
import {
  markUnderReview,
  establishContact,
  enableResidencePayment,
  rejectApplication,
  type ApplicationActionState,
} from "@/app/residence/[residence_id]/applications/actions";
import {
  markResidencePaymentReceived,
  type MarkReceivedState,
} from "@/app/residence/[residence_id]/applications/[id]/payment/actions";

const initialState: ApplicationActionState = { status: "idle" };
const initialPaymentState: MarkReceivedState = { status: "idle" };

const PAYMENT_METHOD_OPTIONS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "virtual_wallet", label: "Billetera virtual" },
  { value: "bank_deposit", label: "Depósito bancario" },
  { value: "other", label: "Otro" },
];

export function ApplicationActions({
  applicationId,
  residenceId,
  status,
  whatsappUrl,
}: {
  applicationId: string;
  residenceId: string;
  status: string;
  whatsappUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [simpleError, setSimpleError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const rejectAction = rejectApplication.bind(null, applicationId);
  const [rejectState, rejectFormAction, isRejectPending] = useActionState(rejectAction, initialState);

  const markReceivedAction = markResidencePaymentReceived.bind(null, applicationId);
  const [paymentState, paymentFormAction, isPaymentPending] = useActionState(
    markReceivedAction,
    initialPaymentState,
  );
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

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

  if (status === "offer_pending_student_acceptance") {
    return (
      <p className="text-sm font-medium text-warning-fg">
        Esperando respuesta del estudiante a tu propuesta de ajuste.
      </p>
    );
  }

  if (status === "contact_established") {
    return (
      <div className="space-y-4">
        {simpleError && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {simpleError}
          </p>
        )}
        <p className="text-sm font-medium text-success-fg">Ya estableciste contacto con esta solicitud.</p>
        <div className="flex flex-wrap gap-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-sage-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage-600"
            >
              Escribir por WhatsApp →
            </a>
          )}
          <Button href={`/residence/${residenceId}/applications/${applicationId}/negotiation`} variant="outline">
            Enviar propuesta de ajuste
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => runSimpleAction(() => enableResidencePayment(applicationId))}
          >
            Continuar sin cambios (habilitar pago)
          </Button>
        </div>
      </div>
    );
  }

  if (status === "residence_payment_pending") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-success-fg">
          Esperando que el estudiante te pague directamente y confirmes acá que lo recibiste.
        </p>
        <form action={paymentFormAction} className="rounded-card border border-sand-200 bg-sand-50 p-4">
          <h3 className="font-bold text-petrol-800">Marcar pago recibido</h3>
          <p className="mt-1 text-xs text-ink-faint">
            Solo confirmá esto cuando el pago ya esté efectivamente en tu cuenta o en tu poder. Habilita la
            reserva y el cobro del fee EstuRed — no se puede deshacer desde acá.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Monto recibido (ARS)" name="received_amount_ars" type="number" min={0} />
            <Input label="Monto recibido (USD)" name="received_amount_usd" type="number" min={0} />
            <Select label="Medio de pago" name="payment_method_label" required defaultValue="">
              <option value="" disabled>
                Elegí una opción
              </option>
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="receipt_file">
                Recibo o evidencia (opcional)
              </label>
              <input
                id="receipt_file"
                name="receipt_file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-petrol-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-petrol-700"
              />
            </div>
          </div>

          {paymentState.status === "error" && (
            <p role="alert" className="mt-4 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              {paymentState.message}
            </p>
          )}

          <label className="mt-4 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="confirmation_checkbox_accepted"
              checked={paymentConfirmed}
              onChange={(e) => setPaymentConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-petrol-600"
            />
            Confirmo que recibí el importe correspondiente, que la plaza queda retenida para el estudiante,
            que la información de la solicitud es correcta y vigente, y acepto que se active el cobro del
            fee EstuRed.
          </label>

          <Button type="submit" disabled={!paymentConfirmed || isPaymentPending} className="mt-4">
            {isPaymentPending ? "Confirmando…" : "Marcar pago recibido"}
          </Button>
        </form>
      </div>
    );
  }

  if (["residence_payment_reported", "converted_to_reservation"].includes(status)) {
    return (
      <p className="text-sm font-medium text-success-fg">
        Marcaste el pago como recibido. La reserva quedó creada y el fee EstuRed está pendiente de pago por
        parte del estudiante — esa etapa se habilita en el próximo ciclo del producto.
      </p>
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
