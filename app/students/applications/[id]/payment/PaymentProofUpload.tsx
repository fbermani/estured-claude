"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  uploadResidencePaymentProof,
  type UploadProofState,
} from "@/app/students/applications/[id]/payment/actions";

const initialState: UploadProofState = { status: "idle" };

const PAYMENT_METHOD_OPTIONS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "virtual_wallet", label: "Billetera virtual" },
  { value: "bank_deposit", label: "Depósito bancario" },
  { value: "other", label: "Otro" },
];

/** Docs/07 §16.1 — carga de referencia, nunca confirma la reserva. */
export function PaymentProofUpload({ applicationId }: { applicationId: string }) {
  const action = uploadResidencePaymentProof.bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "saved") {
    return (
      <Card className="mt-4 border-sage-300 bg-sage-50 p-5">
        <p className="text-sm font-medium text-sage-800">
          Comprobante registrado. Es solo de referencia — la residencia sigue siendo quien confirma que
          recibió el pago.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-5">
      <h3 className="font-bold text-petrol-800">Subir comprobante de pago (opcional)</h3>
      <p className="mt-1 text-xs text-ink-faint">
        Es solo de referencia para vos y la residencia — no confirma tu reserva. Solo la residencia puede
        marcar que recibió el pago.
      </p>
      <form action={formAction} className="mt-3 space-y-3">
        <Input
          label="¿Qué pagaste?"
          name="payment_concept"
          placeholder="Ej: matrícula, seña, depósito"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Monto (ARS)" name="amount_ars" type="number" min={0} />
          <Input label="Monto (USD)" name="amount_usd" type="number" min={0} />
        </div>
        <Select label="Medio de pago" name="payment_method" defaultValue="">
          <option value="">Preferís no decir</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
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

        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Subiendo…" : "Subir comprobante"}
        </Button>
      </form>
    </Card>
  );
}
