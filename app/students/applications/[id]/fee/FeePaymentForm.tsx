"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  registerManualFeePayment,
  type RegisterFeePaymentState,
} from "@/app/students/applications/[id]/fee/actions";
import { FEE_ACKNOWLEDGEMENT_LABEL } from "@/lib/legal/clauses";

const initialState: RegisterFeePaymentState = { status: "idle" };

const IVA_OPTIONS = [
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "monotributista", label: "Monotributista" },
  { value: "exento", label: "Exento" },
];

export function FeePaymentForm({
  applicationId,
  defaults,
}: {
  applicationId: string;
  /** Datos de facturación guardados en el perfil del familiar pagador (DR4): se precargan y se pueden corregir. */
  defaults?: { name: string; taxId: string; vatCondition: string };
}) {
  const action = registerManualFeePayment.bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);

  if (state.status === "saved") {
    return (
      <Card className="mt-6 border-line-2 bg-mint p-5">
        <p className="text-sm font-medium text-forest-700">
          Pago informado. Nuestro equipo valida el comprobante y confirma tu reserva.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-bold text-ink">Ya pagué: subí el comprobante</h2>
      <p className="mt-1 text-xs text-ink-faint">
        El comprobante es obligatorio: EstuRed valida el pago contra él. Abajo, los datos para tu Factura C. Si no tenés CUIT/CUIL, dejalo en blanco.
      </p>
      {defaults && (
        <p className="mt-2 rounded-field bg-sand-100 px-3 py-2 text-xs text-ink-soft">
          Precargamos los datos de facturación de tu perfil; podés corregirlos antes de pagar.{" "}
          <Link href="/students/profile" className="font-semibold text-forest-700 underline">
            Editar mi perfil
          </Link>
        </p>
      )}
      <form action={formAction} className="mt-4 space-y-4">
        <Input label="Nombre completo o razón social" name="payer_billing_name" required defaultValue={defaults?.name} />
        <Input label="CUIT/CUIL o DNI (opcional)" name="payer_billing_cuit" defaultValue={defaults?.taxId} />
        <Select label="Condición frente al IVA" name="payer_iva_condition" defaultValue={defaults?.vatCondition || "consumidor_final"}>
          {IVA_OPTIONS.map((o) => (
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
            className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-700"
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
            className="mt-0.5 h-4 w-4 accent-forest"
          />
          {FEE_ACKNOWLEDGEMENT_LABEL}
        </label>

        <Button type="submit" disabled={!confirmed || isPending}>
          {isPending ? "Enviando…" : "Ya pagué"}
        </Button>
      </form>
    </Card>
  );
}
