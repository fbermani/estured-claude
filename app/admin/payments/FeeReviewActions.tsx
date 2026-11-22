"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { cmd } from "@/components/admin/ui/tokens";
import { DISPUTE_REASON_MAX, DISPUTE_REASON_MIN, RESOLVE_REASON_MAX, RESOLVE_REASON_MIN } from "@/lib/payments/feeAdminLimits";
import { disputeFeePaymentAction, reopenFeePaymentAction, resolveFeeIssueAction, type MarkFeePaidState } from "@/app/admin/payments/actions";

/**
 * Acciones del admin sobre un fee en revisión (DR64 (d) y (e); `docs/08` §8.10). Botones con `name`/`value` nativos y `useFormStatus`
 * (no `onClick` + `setState`: condición de carrera). El texto vive en estado de React para que no se pierda si el servidor rechaza.
 * Toda la validación es server-side; acá solo se guía al admin.
 */

const initial: MarkFeePaidState = { status: "idle" };
const fieldClass = "mt-1.5 w-full rounded border px-3 py-2 text-sm";

function Submit({ children, pendingLabel, variant, name, value, disabled }: { children: string; pendingLabel: string; variant: "primary" | "secondary" | "danger"; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" name={name} value={value} variant={variant} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </AdminButton>
  );
}

function Feedback({ state }: { state: MarkFeePaidState }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-3 text-sm font-medium" style={{ color: cmd.rose }}>
        {state.message}
      </p>
    );
  }
  return null;
}

function Saved({ message }: { message?: string }) {
  return (
    <AdminCard className="p-4 md:p-6">
      <p role="status" className="text-sm font-medium" style={{ color: cmd.emerald }}>
        {message}
      </p>
    </AdminCard>
  );
}

/** «No recibí el pago»: acción secundaria, con motivo de 10 a 500 caracteres y un paso de confirmación. */
export function DisputeFeeForm({ feePaymentId, receiptFileId }: { feePaymentId: string; receiptFileId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState((prev: MarkFeePaidState, fd: FormData) => disputeFeePaymentAction(feePaymentId, prev, fd), initial);

  if (state.status === "saved") return <Saved message={state.message} />;
  if (!open) {
    return (
      <AdminButton type="button" variant="secondary" onClick={() => setOpen(true)}>
        No recibí el pago
      </AdminButton>
    );
  }
  const tooShort = reason.trim().length < DISPUTE_REASON_MIN;
  return (
    <form action={formAction}>
      <input type="hidden" name="receipt_file_id" value={receiptFileId} />
      <AdminCard className="p-4 md:p-6">
        <h3 className="text-base font-bold" style={{ color: cmd.onSurface }}>
          No recibí el pago
        </h3>
        <p className="mt-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          El pago queda en revisión, se abre un caso de Soporte y se avisa al pagador sin mostrarle este motivo. La reserva no se confirma.
        </p>
        <label htmlFor="dispute_reason" className="mt-3 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Qué pasó (obligatorio, de {DISPUTE_REASON_MIN} a {DISPUTE_REASON_MAX} caracteres)
        </label>
        <textarea
          id="dispute_reason"
          name="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={DISPUTE_REASON_MAX}
          className={fieldClass}
          style={{ borderColor: cmd.outline }}
          placeholder="Ej: el monto no figura en la cuenta ni con el comprobante"
        />
        <Feedback state={state} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Submit variant="danger" pendingLabel="Registrando…" disabled={tooShort}>
            Registrar que no recibí el pago
          </Submit>
          <AdminButton type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </AdminButton>
        </div>
      </AdminCard>
    </form>
  );
}

/** Respuesta al aviso «No pude realizar el pago»: «Reabrir el pago» (principal) o «Contactar al pagador». Ambas dan 48 h más. */
export function IssueResponseForm({ feePaymentId, canContact, issueReason }: { feePaymentId: string; canContact: boolean; issueReason: string | null }) {
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState((prev: MarkFeePaidState, fd: FormData) => resolveFeeIssueAction(feePaymentId, prev, fd), initial);

  if (state.status === "saved") return <Saved message={state.message} />;
  const tooShort = reason.trim().length < RESOLVE_REASON_MIN;
  return (
    <form action={formAction}>
      <AdminCard className="p-4 md:p-6">
        <h3 className="text-base font-bold" style={{ color: cmd.rose }}>
          El pagador avisó que no pudo pagar
        </h3>
        {issueReason && (
          <p className="mt-1.5 break-words text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Motivo que escribió: “{issueReason}”
          </p>
        )}
        <p className="mt-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Mientras no respondas, el plazo no corre. Al responder, el pagador tiene 48 horas más.
        </p>
        <label htmlFor="resolve_reason" className="mt-3 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Motivo de tu respuesta (obligatorio, al menos {RESOLVE_REASON_MIN} caracteres)
        </label>
        <textarea
          id="resolve_reason"
          name="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={RESOLVE_REASON_MAX}
          className={fieldClass}
          style={{ borderColor: cmd.outline }}
          placeholder="Ej: el medio elegido no le funcionó; puede probar con otro"
        />
        <Feedback state={state} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Submit variant="primary" name="resolution" value="reopen_payment" pendingLabel="Reabriendo…" disabled={tooShort}>
            Reabrir el pago
          </Submit>
          {canContact && (
            <Submit variant="secondary" name="resolution" value="contact_payer" pendingLabel="Abriendo caso…" disabled={tooShort}>
              Contactar al pagador
            </Submit>
          )}
        </div>
      </AdminCard>
    </form>
  );
}

/** Tras «No recibí el pago»: reabrir el pago (el pagador elige el medio y sube otro comprobante). */
export function ReopenAfterDisputeForm({ feePaymentId, disputeReason }: { feePaymentId: string; disputeReason: string | null }) {
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState((prev: MarkFeePaidState, fd: FormData) => reopenFeePaymentAction(feePaymentId, prev, fd), initial);

  if (state.status === "saved") return <Saved message={state.message} />;
  const tooShort = reason.trim().length < RESOLVE_REASON_MIN;
  return (
    <form action={formAction}>
      <AdminCard className="p-4 md:p-6">
        <h3 className="text-base font-bold" style={{ color: cmd.rose }}>
          Registraste que no recibiste este pago
        </h3>
        {disputeReason && (
          <p className="mt-1.5 break-words text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Tu motivo: “{disputeReason}”
          </p>
        )}
        <p className="mt-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          El fee no vence mientras Soporte lo revisa. Si el pago aparece, validalo abajo. Si no, reabrilo: el pagador elige el medio y sube otro comprobante en 48 horas.
        </p>
        <label htmlFor="reopen_reason" className="mt-3 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Motivo de la reapertura (obligatorio, al menos {RESOLVE_REASON_MIN} caracteres)
        </label>
        <textarea
          id="reopen_reason"
          name="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={RESOLVE_REASON_MAX}
          className={fieldClass}
          style={{ borderColor: cmd.outline }}
        />
        <Feedback state={state} />
        <div className="mt-4">
          <Submit variant="secondary" pendingLabel="Reabriendo…" disabled={tooShort}>
            Reabrir el pago
          </Submit>
        </div>
      </AdminCard>
    </form>
  );
}
