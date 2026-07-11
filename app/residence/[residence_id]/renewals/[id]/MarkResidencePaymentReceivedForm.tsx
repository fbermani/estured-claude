"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  markRenewalResidencePaymentReceivedAction,
  type RenewalOfferFormState,
} from "@/app/residence/[residence_id]/renewals/actions";

const initialState: RenewalOfferFormState = { status: "idle" };

const PAYMENT_METHOD_OPTIONS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "virtual_wallet", label: "Billetera virtual" },
  { value: "bank_deposit", label: "Depósito bancario" },
  { value: "other", label: "Otro" },
];

export function MarkResidencePaymentReceivedForm({
  offerId,
  residenceId,
  reservationId,
}: {
  offerId: string;
  residenceId: string;
  reservationId: string;
}) {
  const action = markRenewalResidencePaymentReceivedAction.bind(null, offerId, residenceId, reservationId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={formAction} className="rounded-card border border-sand-200 bg-sand-50 p-4">
      <h3 className="font-bold text-petrol-800">Marcar pago recibido</h3>
      <p className="mt-1 text-xs text-ink-faint">
        Solo confirmá esto cuando el pago ya esté efectivamente en tu cuenta o en tu poder. Habilita el
        cobro del fee EstuRed de la renovación — no se puede deshacer desde acá.
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

      {state.status === "error" && (
        <p role="alert" className="mt-4 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <label className="mt-4 flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="confirmation_checkbox_accepted"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-petrol-600"
        />
        Confirmo que recibí el importe correspondiente y acepto que se active el cobro del fee EstuRed de
        la renovación.
      </label>

      <Button type="submit" disabled={!confirmed || isPending} className="mt-4">
        {isPending ? "Confirmando…" : "Marcar pago recibido"}
      </Button>
    </form>
  );
}
