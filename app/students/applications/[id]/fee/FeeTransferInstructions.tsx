import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatArs } from "@/lib/mock/exchange";
import { formatCbu, formatCuit } from "@/lib/payments/feeTransferPresentation";
import type { PaymentInstructions } from "@/lib/payments/paymentSettings";

function Row({ label, value, copyValue, mono = false }: { label: string; value: string; copyValue?: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-sand-200 py-2.5 last:border-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className={`break-all font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
        {copyValue && <CopyButton value={copyValue} label={label.toLowerCase()} />}
      </dd>
    </div>
  );
}

/**
 * D2 / H02 — datos para pagar el fee por transferencia: monto exacto en ARS,
 * referencia de la reserva y cuenta de destino cargada por el admin.
 * Server component: recibe solo lo necesario para pagar.
 */
export function FeeTransferInstructions({
  amountArs,
  reference,
  instructions,
}: {
  amountArs: number;
  reference: string;
  instructions: PaymentInstructions;
}) {
  return (
    <Card className="mt-6 p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Icon name="account_balance" className="text-xl text-forest-700" /> Cómo pagar por transferencia
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Transferí exactamente el monto de abajo y poné la referencia en el concepto. Después subí el comprobante
        acá. La reserva se confirma cuando EstuRed valida el pago.
      </p>

      <dl className="mt-4 text-sm">
        <Row label="Monto a transferir" value={formatArs(amountArs)} copyValue={String(amountArs)} />
        <Row label="Referencia" value={reference} copyValue={reference} mono />
        <Row label="Titular" value={instructions.accountHolder} />
        <Row label="Alias" value={instructions.alias} copyValue={instructions.alias} />
        <Row label="CBU" value={formatCbu(instructions.cbu)} copyValue={instructions.cbu} mono />
        <Row label="Banco" value={instructions.bankName} />
        {instructions.holderCuit && <Row label="CUIT/CUIL del titular" value={formatCuit(instructions.holderCuit)} />}
      </dl>

      {instructions.instructions && (
        <p className="mt-3 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">{instructions.instructions}</p>
      )}
    </Card>
  );
}
