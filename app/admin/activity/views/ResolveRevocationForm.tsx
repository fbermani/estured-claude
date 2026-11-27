"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { resolveRevocationAction, type ResolveRevocationState } from "@/app/admin/activity/revocationActions";
import { Input, Select, Textarea } from "@/components/ui/Input";

const initialState: ResolveRevocationState = { status: "idle" };

/**
 * Botón de envío con `name`/`value` NATIVOS (la decisión viaja en el FormData, no en estado del cliente: evita la carrera de
 * `onClick` + `setState`) y `useFormStatus` para deshabilitar ambos botones mientras se guarda.
 */
function DecisionButton({ value, label, pendingLabel, variant }: { value: "refunded" | "denied"; label: string; pendingLabel: string; variant: "primary" | "danger" }) {
  const { pending, data } = useFormStatus();
  const thisOne = pending && data?.get("decision") === value;
  return (
    <AdminButton type="submit" name="decision" value={value} variant={variant} disabled={pending} formNoValidate>
      {thisOne ? pendingLabel : label}
    </AdminButton>
  );
}

/**
 * "Resolver revocación" (DR6): un único formulario con el motivo interno y el mensaje al estudiante compartidos, el bloque de
 * reintegro y el de denegación. Todos los campos son controlados: ante un error de validación el servidor responde sin recargar y
 * React no pierde lo escrito. La validación real es del servidor (`resolveFeeRevocation`); acá no hay `required` nativo.
 */
export function ResolveRevocationForm({
  reservationId,
  feeAmountArs,
  withinWindow,
  dayLabel,
  paidInUsd,
  todayIso,
}: {
  reservationId: string;
  feeAmountArs: number;
  withinWindow: boolean;
  /** Ej: "día 3 de 10" o "fuera de plazo (día 12)". */
  dayLabel: string;
  paidInUsd: boolean;
  todayIso: string;
}) {
  const action = resolveRevocationAction.bind(null, reservationId);
  const [state, formAction] = useActionState(action, initialState);

  const [internalReason, setInternalReason] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [refundMethod, setRefundMethod] = useState("bank_transfer");
  const [refundReference, setRefundReference] = useState("");
  const [refundedOn, setRefundedOn] = useState(todayIso);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [justifiedCause, setJustifiedCause] = useState(false);
  const [confirmDenial, setConfirmDenial] = useState(false);
  const [acknowledgeUsd, setAcknowledgeUsd] = useState(false);

  // Tras un error del servidor se destildan las confirmaciones: hay que volver a confirmarlas conscientemente (los textos se conservan).
  // Ajuste de estado durante el render (patrón recomendado por React), una vez por respuesta.
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.status === "error") {
      setConfirmRefund(false);
      setJustifiedCause(false);
      setConfirmDenial(false);
      setAcknowledgeUsd(false);
    }
  }

  const amountLabel = `ARS ${feeAmountArs.toLocaleString("es-AR")}`;

  return (
    <form action={formAction} className="mt-4 space-y-5 border-t pt-4" style={{ borderColor: cmd.border }}>
      <div>
        <Textarea
          label="Motivo interno (obligatorio)"
          hint="De 10 a 1000 caracteres. Queda auditado y el estudiante nunca lo ve."
          id={`reason-${reservationId}`}
          name="internal_reason"
          rows={3}
          maxLength={1000}
          value={internalReason}
          onChange={(e) => setInternalReason(e.target.value)}
          placeholder="Ej: dentro de plazo, sin indicios de uso del contacto por fuera de la plataforma"
        />
      </div>

      <div>
        <Textarea
          label="Mensaje al estudiante (opcional)"
          hint="Es lo único que ve el estudiante de esta resolución."
          id={`message-${reservationId}`}
          name="student_message"
          rows={2}
          maxLength={1000}
          value={studentMessage}
          onChange={(e) => setStudentMessage(e.target.value)}
        />
      </div>

      <div className="rounded-lg p-4" style={{ backgroundColor: cmd.surfaceContainerLow }}>
        <p className="text-sm font-bold" style={{ color: cmd.onSurface }}>
          Reintegrar el fee
        </p>
        <p className="mt-1 text-xs" style={{ color: cmd.onSurfaceVariant }}>
          El reintegro se hace por fuera de EstuRed (por ejemplo, una transferencia). Acá solo registrás que ya lo hiciste.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Select
              label="Medio"
              id={`method-${reservationId}`}
              name="refund_method"
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
            >
              <option value="bank_transfer">Transferencia bancaria</option>
              <option value="digital_wallet">Billetera virtual</option>
              <option value="other">Otro medio</option>
            </Select>
          </div>
          <div>
            <Input
              label="Fecha del reintegro"
              id={`date-${reservationId}`}
              type="date"
              name="refunded_on"
              value={refundedOn}
              max={todayIso}
              onChange={(e) => setRefundedOn(e.target.value)}
            />
          </div>
        </div>
        <Input
          label="Referencia de la operación"
          hint="N.º de operación (sin CBU/CVU/alias)."
          id={`ref-${reservationId}`}
          name="refund_reference"
          maxLength={120}
          value={refundReference}
          onChange={(e) => setRefundReference(e.target.value)}
          className="mt-3"
        />
        {paidInUsd && (
          <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: cmd.amberBg }}>
            <p role="alert" className="text-sm font-semibold" style={{ color: cmd.amber }}>
              Este fee se pagó en USD: el reintegro se registra en ARS (no hay moneda de reintegro): confirmá el monto con quien corresponda.
            </p>
            <label className="mt-2 flex items-start gap-2.5 text-sm" style={{ color: cmd.onSurface }}>
              <input
                type="checkbox"
                name="acknowledge_usd_refund"
                checked={acknowledgeUsd}
                onChange={(e) => setAcknowledgeUsd(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>Entiendo que el fee se pagó en USD y que el reintegro queda registrado en ARS.</span>
            </label>
          </div>
        )}
        <label className="mt-3 flex items-start gap-2.5 text-sm" style={{ color: cmd.onSurface }}>
          <input
            type="checkbox"
            name="confirm_refund_amount_ars"
            value={String(feeAmountArs)}
            checked={confirmRefund}
            onChange={(e) => setConfirmRefund(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>Confirmo que reintegré {amountLabel}, el fee completo.</span>
        </label>
        <div className="mt-3">
          <DecisionButton value="refunded" label="Reintegrar fee" pendingLabel="Guardando…" variant="primary" />
        </div>
      </div>

      <div className="rounded-lg p-4" style={{ backgroundColor: cmd.roseBg }}>
        <p className="text-sm font-bold" style={{ color: cmd.rose }}>
          Denegar la revocación
        </p>
        <p className="mt-1 text-xs" style={{ color: cmd.onSurfaceVariant }}>
          La reserva no se restaura: sigue cancelada y el fee queda pagado.
          {withinWindow
            ? ` Se revocó dentro de los 10 días (${dayLabel}): el reintegro es incondicional. Solo se deniega por una causa ajena al uso del servicio (por ejemplo, un pedido duplicado o hecho por error).`
            : ` Se revocó ${dayLabel}.`}
        </p>
        {withinWindow && (
          <label className="mt-3 flex items-start gap-2.5 text-sm" style={{ color: cmd.onSurface }}>
            <input
              type="checkbox"
              name="justified_cause"
              checked={justifiedCause}
              onChange={(e) => setJustifiedCause(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>Es un pedido duplicado o hecho por error, no un tema de uso del servicio (lo explico en el motivo).</span>
          </label>
        )}
        <label className="mt-3 flex items-start gap-2.5 text-sm" style={{ color: cmd.onSurface }}>
          <input
            type="checkbox"
            name="confirm_denial"
            checked={confirmDenial}
            onChange={(e) => setConfirmDenial(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>Confirmo que quiero denegar esta revocación.</span>
        </label>
        <div className="mt-3">
          <DecisionButton value="denied" label="Denegar revocación" pendingLabel="Guardando…" variant="danger" />
        </div>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm font-medium" style={{ color: cmd.emerald }}>
          Resolución registrada.
        </p>
      )}
    </form>
  );
}
