import { Icon } from "@/components/ui/Icon";
import { describePaymentDeadline } from "@/lib/applications/paymentDeadline";

/**
 * H02 — plazo visible para pagar el fee EstuRed en "Mis solicitudes"
 * (`estured_fee_payments.expires_at`, reserva en `pending_estured_fee`).
 * Presentación pura: el vencimiento lo hace el job `expireEsturedFeeWindows`.
 */
export function FeeDeadlineNote({ expiresAt, className = "" }: { expiresAt: string | null; className?: string }) {
  const info = describePaymentDeadline(expiresAt);
  if (!info) return null;
  return (
    <p
      className={`flex items-start gap-2 rounded-field px-4 py-3 text-sm ${
        info.urgent ? "bg-warning-bg text-warning-fg" : "bg-sand-100 text-ink-soft"
      } ${className}`}
    >
      <Icon name="schedule" className="mt-0.5 text-base" />
      <span>
        <span className="font-bold">
          {info.relative} ({info.absolute})
        </span>
        . Si no se registra el pago del fee antes, la reserva vence.
      </span>
    </p>
  );
}
