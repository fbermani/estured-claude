"use client";

import { useActionState } from "react";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { markFeePaidManually, type MarkFeePaidState } from "@/app/admin/payments/actions";

interface FeePayment {
  id: string;
  status: string;
  fee_amount_ars: number;
  fee_base_usd: number;
  fee_base_ars: number;
  payment_channel: string | null;
  payer_billing_name: string | null;
  payer_billing_cuit: string | null;
  payer_iva_condition: string;
  reservations: {
    residences: { name: string } | null;
    student_profiles: { first_name: string; last_initial: string } | null;
    start_date: string;
    initial_duration_months: number;
  } | null;
}

const initialState: MarkFeePaidState = { status: "idle" };

export function PaymentDetail({ feePayment, proofUrl }: { feePayment: FeePayment; proofUrl: string | null }) {
  const action = markFeePaidManually.bind(null, feePayment.id);
  const [state, formAction] = useActionState(action, initialState);
  const reservation = feePayment.reservations;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <AdminCard className="p-6">
        <h2 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
          {reservation?.student_profiles?.first_name} {reservation?.student_profiles?.last_initial} —{" "}
          {reservation?.residences?.name}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Fee base (USD)</dt>
            <dd style={{ color: cmd.onSurface }}>USD {feePayment.fee_base_usd}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Fee a cobrar</dt>
            <dd className="font-bold" style={{ color: cmd.onSurface }}>
              ARS {Number(feePayment.fee_amount_ars).toLocaleString("es-AR")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Fecha de ingreso</dt>
            <dd style={{ color: cmd.onSurface }}>{reservation?.start_date}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Medio informado</dt>
            <dd style={{ color: cmd.onSurface }}>{feePayment.payment_channel ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Facturar a</dt>
            <dd style={{ color: cmd.onSurface }}>
              {feePayment.payer_billing_name ?? "—"} {feePayment.payer_billing_cuit ? `(${feePayment.payer_billing_cuit})` : ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Condición IVA</dt>
            <dd style={{ color: cmd.onSurface }}>{feePayment.payer_iva_condition}</dd>
          </div>
        </dl>
        {proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-semibold underline"
            style={{ color: cmd.primary }}
          >
            Ver comprobante subido →
          </a>
        ) : (
          <p className="mt-4 text-sm" style={{ color: cmd.outline }}>
            El estudiante todavía no subió comprobante.
          </p>
        )}
      </AdminCard>

      <AdminCard className="p-6">
        <label className="block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Moneda del pago recibido
        </label>
        <select
          name="payment_currency"
          defaultValue="ARS"
          className="mt-1.5 w-full rounded border px-3 py-2 text-sm"
          style={{ borderColor: cmd.outline }}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>

        <label className="mt-4 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Referencia del pago (opcional)
        </label>
        <input
          name="payment_provider_reference"
          className="mt-1.5 w-full rounded border px-3 py-2 text-sm"
          style={{ borderColor: cmd.outline }}
          placeholder="Ej: últimos 4 dígitos, número de operación"
        />

        <label className="mt-4 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Motivo / notas de la validación (obligatorio)
        </label>
        <textarea
          name="reason"
          rows={2}
          required
          className="mt-1.5 w-full rounded border px-3 py-2 text-sm"
          style={{ borderColor: cmd.outline }}
          placeholder="Ej: confirmado por comprobante de transferencia, coincide con el monto"
        />

        {state.status === "error" && (
          <p role="alert" className="mt-3 text-sm font-medium" style={{ color: cmd.rose }}>
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p className="mt-3 text-sm font-medium" style={{ color: cmd.emerald }}>
            Pago validado. Reserva confirmada y comprobante generado.
          </p>
        )}

        <AdminButton type="submit" variant="primary" className="mt-4">
          Marcar pagado y confirmar reserva
        </AdminButton>
      </AdminCard>
    </form>
  );
}
