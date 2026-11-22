import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import type { FeeCurrency } from "@/lib/payments/feeCollection";

function Row({ label, value, copyValue, mono = false }: { label: string; value: string; copyValue?: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-sand-200 py-2.5 last:border-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className={`break-all font-semibold tabular-nums text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
        {copyValue && <CopyButton value={copyValue} label={label.toLowerCase()} />}
      </dd>
    </div>
  );
}

/**
 * Datos para pagar el fee con el medio elegido (DR64 (b); `docs/08` §6.8): monto en la moneda del medio, referencia de la reserva y
 * datos de cobro de EstuRed congelados al elegir. Server component: recibe solo lo que el pagador designado puede ver.
 */
export function FeeMethodCard({
  label,
  currency,
  amount,
  reference,
  details,
}: {
  label: string;
  currency: FeeCurrency;
  amount: number | null;
  reference: string;
  details: string;
}) {
  const amountText = amount === null ? "—" : currency === "USD" ? formatUsd(amount) : formatArs(amount);
  const amountCopy = amount === null ? undefined : currency === "USD" ? amount.toFixed(2) : String(amount);
  return (
    <Card className="mt-4 p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Icon name="account_balance" className="text-xl text-forest-700" /> Cómo pagar con {label}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Pagá exactamente el monto de abajo y poné la referencia en el concepto si el medio lo permite. Después tocá «Ya pagué» y subí el
        comprobante. La reserva se confirma cuando EstuRed valida el pago.
      </p>

      <dl className="mt-4 text-sm">
        <Row label="Monto a pagar" value={amountText} copyValue={amountCopy} />
        <Row label="Referencia" value={reference} copyValue={reference} mono />
      </dl>

      <div className="mt-3 rounded-field bg-sand-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-ink-soft">Datos de cobro</p>
          <CopyButton value={details} label="datos de cobro" />
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium text-ink">{details}</p>
      </div>

      {currency === "USD" && (
        <p className="mt-3 text-xs text-ink-faint">
          El monto en USD se calculó con la cotización del dólar blue al momento de crear tu solicitud.
        </p>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
        <Icon name="shield" className="mt-0.5 shrink-0 text-base text-forest-700" />
        <span>Pagá solo a los datos de esta pantalla. EstuRed no responde por pagos hechos a otros datos.</span>
      </p>
    </Card>
  );
}
