"use client";

import { PermissionNote } from "@/components/residences/PermissionGate";
import { STAFF_PERMISSIONS, type ResidencePermission } from "@/lib/residences/permissions";
import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea, Input } from "@/components/ui/Input";
import { REJECTION_REASONS } from "@/lib/applications/types";
import { getVisibleStatus, type ReservationStatusInput } from "@/lib/applications/visibleStatus";
import { describePaymentDeadline } from "@/lib/applications/paymentDeadline";
import { Icon } from "@/components/ui/Icon";
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

/**
 * Qué puede hacer la persona que mira (DR11), resuelto en el servidor desde sus permisos en ESTA residencia. Es solo presentación:
 * lo apagado se muestra deshabilitado con una nota (no se oculta), pero el servidor valida cada acción por su cuenta.
 */
export type ApplicationAllowed = {
  reviewContact: boolean;
  reject: boolean;
  residencePayment: boolean;
  sendAdjustment: boolean;
};

/** Nota "Pedile al dueño el permiso: X" con el nombre de lo que falta (reutiliza `PermissionNote`). No renderiza nada si no falta nada. */
function PermissionHint({ missing }: { missing: ResidencePermission[] }) {
  if (missing.length === 0) return null;
  const labels = missing.map((key) => STAFF_PERMISSIONS.find((p) => p.key === key)?.label ?? key);
  return <PermissionNote text={`Pedile al dueño el permiso: ${labels.join(" / ")}.`} />;
}

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
  reservation,
  whatsappUrl,
  paymentDeadlineAt = null,
  allowed,
}: {
  applicationId: string;
  residenceId: string;
  status: string;
  reservation: ReservationStatusInput | null;
  whatsappUrl: string | null;
  /** `application_requests.payment_deadline_at`: plazo de 48 h de `contact_established` (H06). */
  paymentDeadlineAt?: string | null;
  /** DR11: permisos de quien mira. Solo presentación: el servidor rechaza lo que no esté permitido. */
  allowed: ApplicationAllowed;
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

  // H24: "cerrada" sale del helper de estado visible (cubre también vencida por falta de pago, cancelada
  // por la residencia, cerrada por otra reserva, etc.), no de una lista a mano.
  const visibleStatus = getVisibleStatus({ applicationStatus: status, reservation, viewer: "residence" });
  if (visibleStatus.isClosed && visibleStatus.source === "application") {
    return (
      <p className="text-sm text-ink-faint">
        Esta solicitud ya está cerrada: {visibleStatus.label.charAt(0).toLowerCase()}
        {visibleStatus.label.slice(1)}.
      </p>
    );
  }

  if (status === "paused_due_to_other_active_request") {
    return (
      <p className="text-sm text-ink-faint">
        Esta solicitud está pausada porque el estudiante avanzó con otra residencia. No hace falta que hagas nada: si esa
        otra solicitud se cancela o vence, esta vuelve a aparecer como nueva.
      </p>
    );
  }

  if (status === "queued_for_place") {
    return (
      <p className="text-sm text-ink-faint">
        Esta solicitud está en cola: ya tenés 3 solicitudes visibles para este tipo de habitación. Se
        vuelve visible automáticamente cuando cierres o rechaces alguna de las otras.
      </p>
    );
  }

  if (status === "offer_pending_student_acceptance") {
    return (
      <p className="text-sm font-medium text-warning-fg">
        Esperando respuesta del estudiante a tu propuesta de ajuste.
      </p>
    );
  }

  if (status === "contact_established") {
    const contactDeadline = describePaymentDeadline(paymentDeadlineAt);
    return (
      <div className="space-y-4">
        {simpleError && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {simpleError}
          </p>
        )}
        <p className="text-sm font-medium text-success-fg">Ya estableciste contacto con esta solicitud.</p>
        {contactDeadline && (
          <p
            className={`flex items-start gap-2 rounded-field px-4 py-3 text-sm ${
              contactDeadline.urgent ? "bg-danger-bg text-danger-fg" : "bg-sand-100 text-ink-soft"
            }`}
          >
            <Icon name="schedule" className="mt-0.5 text-base" />
            <span>
              <span className="font-bold">
                {contactDeadline.relative} ({contactDeadline.absolute})
              </span>
              . Si antes no habilitás el pago ni enviás una propuesta de ajuste, la solicitud vence y se cierra.
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
            >
              Escribir por WhatsApp →
            </a>
          )}
          {allowed.sendAdjustment ? (
            <Button href={`/residence/${residenceId}/applications/${applicationId}/negotiation`} variant="outline">
              Enviar propuesta de ajuste
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Enviar propuesta de ajuste
            </Button>
          )}
          <Button
            variant="outline"
            disabled={isPending || !allowed.residencePayment}
            onClick={() => runSimpleAction(() => enableResidencePayment(applicationId))}
          >
            Continuar sin cambios (habilitar pago)
          </Button>
        </div>
        <PermissionHint missing={[...(allowed.sendAdjustment ? [] : ["applications.send_adjustment" as const]), ...(allowed.residencePayment ? [] : ["payments.residence" as const])]} />
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
         <fieldset disabled={!allowed.residencePayment} className="m-0 min-w-0 border-0 p-0">
          <h3 className="font-bold text-ink">Marcar pago recibido</h3>
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
                className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-700"
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
              className="mt-0.5 h-4 w-4 accent-forest"
            />
            Confirmo que recibí el importe correspondiente, que la plaza queda retenida para el estudiante,
            que la información de la solicitud es correcta y vigente, y acepto que se active el cobro del
            fee EstuRed.
          </label>

          <Button type="submit" disabled={!paymentConfirmed || isPaymentPending || !allowed.residencePayment} className="mt-4">
            {isPaymentPending ? "Confirmando…" : "Marcar pago recibido"}
          </Button>
         </fieldset>
         <div className="mt-3">
           <PermissionHint missing={allowed.residencePayment ? [] : ["payments.residence"]} />
         </div>
        </form>
      </div>
    );
  }

  if (["residence_payment_reported", "converted_to_reservation"].includes(status)) {
    // H01: el texto sale del estado REAL de la reserva (cancelada, vencida, confirmada…), no de un
    // "fee pendiente" fijo.
    const visible = getVisibleStatus({ applicationStatus: status, reservation, viewer: "residence" });
    return (
      <p className={`text-sm font-medium ${visible.tone === "sage" ? "text-success-fg" : "text-ink-soft"}`}>
        {visible.helper ||
          (visible.source === "application" ? "Marcaste el pago como recibido. La reserva está en proceso." : visible.label)}
      </p>
    );
  }

  // Solo "Nueva" y "En revisión" admiten acciones de la residencia (docs/04 §5.4). Cualquier otro estado
  // (en disputa, condiciones aceptadas, desconocido) se explica con texto en vez de ofrecer botones que el
  // servidor rechazaría.
  if (!["submitted", "under_review"].includes(status)) {
    return (
      <p className="text-sm text-ink-soft">
        {visibleStatus.helper || "No hay acciones disponibles para esta solicitud en este momento."}
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

      <p className="flex items-start gap-2 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
        <Icon name="info" className="mt-0.5 text-base" />
        <span>
          <span className="font-bold text-ink">Establecer contacto equivale a aceptar la solicitud.</span> Desde ahí
          tenés 48 h para habilitar el pago o enviar una propuesta de ajuste; si no, la solicitud vence. Después: contacto
          → ajuste opcional → habilitar pago → marcar pago recibido.
        </span>
      </p>

      <div className="flex flex-wrap gap-3">
        {status === "submitted" && (
          <Button
            variant="outline"
            disabled={isPending || !allowed.reviewContact}
            onClick={() => runSimpleAction(() => markUnderReview(applicationId))}
          >
            Marcar en revisión
          </Button>
        )}
        <Button disabled={isPending || !allowed.reviewContact} onClick={() => runSimpleAction(() => establishContact(applicationId))}>
          Establecer contacto
        </Button>
        <Button variant="outline" disabled={isPending || !allowed.reject} onClick={() => setShowRejectForm((v) => !v)}>
          Rechazar
        </Button>
      </div>
      <PermissionHint missing={[...(allowed.reviewContact ? [] : ["applications.review_contact" as const]), ...(allowed.reject ? [] : ["applications.reject" as const])]} />

      {showRejectForm && allowed.reject && (
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
