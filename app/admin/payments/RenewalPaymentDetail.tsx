"use client";

import { ivaConditionLabel, paymentChannelLabel } from "@/lib/format/payerLabels";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatShortName } from "@/lib/format/shortName";
import { useActionState } from "react";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { cmd } from "@/components/admin/ui/tokens";
import { markRenewalFeePaidManually, type MarkFeePaidState } from "@/app/admin/payments/actions";
import { Input, Select, Textarea } from "@/components/ui/Input";

interface RenewalFeePayment {
  id: string;
  status: string;
  fee_amount_ars: number;
  fee_base_usd: number;
  fee_base_ars: number;
  payment_channel: string | null;
  payer_billing_name: string | null;
  payer_billing_cuit: string | null;
  payer_iva_condition: string;
  renewal_offers: {
    residences: { name: string } | null;
    student_profiles: { first_name: string; last_initial: string } | null;
    period_start_date: string;
    period_end_date: string;
    duration_months: number;
  } | null;
}

const initialState: MarkFeePaidState = { status: "idle" };

export function RenewalPaymentDetail({
  feePayment,
  proofFileId,
}: {
  feePayment: RenewalFeePayment;
  proofFileId: string | null;
}) {
  const action = markRenewalFeePaidManually.bind(null, feePayment.id);
  const [state, formAction] = useActionState(action, initialState);
  const offer = feePayment.renewal_offers;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <AdminCard className="p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            {formatShortName(offer?.student_profiles?.first_name, offer?.student_profiles?.last_initial)} — {offer?.residences?.name}
          </h2>
          <span
            className="rounded-field px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: cmd.violetBg, color: cmd.violet }}
          >
            Renovación
          </span>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Nuevo período</dt>
            <dd style={{ color: cmd.onSurface }}>
              {formatDateOnly(offer?.period_start_date)} → {formatDateOnly(offer?.period_end_date)} ({offer?.duration_months} meses)
            </dd>
          </div>
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
            <dt style={{ color: cmd.outline }}>Medio informado</dt>
            <dd style={{ color: cmd.onSurface }}>{paymentChannelLabel(feePayment.payment_channel)}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Facturar a</dt>
            <dd style={{ color: cmd.onSurface }}>
              {feePayment.payer_billing_name ?? "—"}{" "}
              {feePayment.payer_billing_cuit ? `(${feePayment.payer_billing_cuit})` : ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: cmd.outline }}>Condición IVA</dt>
            <dd style={{ color: cmd.onSurface }}>{ivaConditionLabel(feePayment.payer_iva_condition)}</dd>
          </div>
        </dl>
        {proofFileId ? (
          <div className="mt-4">
            <DocumentAccessButton fileId={proofFileId} label="Ver comprobante subido →" />
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: cmd.outline }}>
            El estudiante todavía no subió comprobante.
          </p>
        )}
      </AdminCard>

      <AdminCard className="p-6">
        <Select label="Moneda del pago recibido" name="payment_currency" defaultValue="ARS">
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Select>

        <Input
          label="Referencia del pago (opcional)"
          name="payment_provider_reference"
          placeholder="Ej: últimos 4 dígitos, número de operación"
          className="mt-4"
        />

        <Textarea
          label="Motivo (obligatorio)"
          hint="Notas de la validación."
          name="reason"
          rows={2}
          required
          placeholder="Ej: confirmado por comprobante de transferencia, coincide con el monto"
          className="mt-4"
        />

        {state.status === "error" && (
          <p role="alert" className="mt-3 text-sm font-medium" style={{ color: cmd.rose }}>
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p className="mt-3 text-sm font-medium" style={{ color: cmd.emerald }}>
            Pago validado. Renovación confirmada y comprobante generado.
          </p>
        )}

        <AdminButton type="submit" variant="primary" className="mt-4">
          Marcar pagado y confirmar renovación
        </AdminButton>
      </AdminCard>
    </form>
  );
}
