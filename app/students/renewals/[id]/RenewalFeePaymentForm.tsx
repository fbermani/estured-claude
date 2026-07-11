"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  registerRenewalFeePaymentAction,
  type RenewalFormState,
} from "@/app/students/renewals/actions";

const initialState: RenewalFormState = { status: "idle" };

const IVA_OPTIONS = [
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributista", label: "Monotributista" },
  { value: "exento", label: "Exento" },
];

export function RenewalFeePaymentForm({ renewalOfferId }: { renewalOfferId: string }) {
  const action = registerRenewalFeePaymentAction.bind(null, renewalOfferId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);

  if (state.status === "saved") {
    return (
      <Card className="mt-6 border-sage-300 bg-sage-50 p-5">
        <p className="text-sm font-medium text-sage-800">
          Comprobante registrado. Nuestro equipo lo va a validar y confirmar tu renovación.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-bold text-petrol-800">Pagar el fee EstuRed de la renovación</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Datos para tu Factura C. Si no tenés CUIT/CUIL, dejalo en blanco.
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <Input label="Nombre completo o razón social" name="payer_billing_name" required />
        <Input label="CUIT/CUIL (opcional)" name="payer_billing_cuit" />
        <Select label="Condición frente al IVA" name="payer_iva_condition" defaultValue="consumidor_final">
          {IVA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input label="Medio de pago (ej: transferencia)" name="payment_channel" />
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="file">
            Comprobante (PDF, JPG, PNG o WebP)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-petrol-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-petrol-700"
          />
        </div>

        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}

        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="acknowledge_no_refund"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-petrol-600"
          />
          Entiendo que el fee EstuRed no se reembolsa automáticamente ante una cancelación.
        </label>

        <Button type="submit" disabled={!confirmed || isPending}>
          {isPending ? "Enviando…" : "Registrar pago"}
        </Button>
      </form>
    </Card>
  );
}
