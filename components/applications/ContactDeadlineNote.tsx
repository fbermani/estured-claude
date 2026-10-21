import { Icon } from "@/components/ui/Icon";
import { describePaymentDeadline } from "@/lib/applications/paymentDeadline";

/**
 * H06 — plazo visible del estudiante cuando su solicitud está en "Contacto
 * establecido" (docs/04 l.303: sin pago a la residencia en 48 h vence).
 * Presentación pura: el vencimiento lo hace el job `expireApplicationRequests`.
 */
export function ContactDeadlineNote({ deadlineAt, className = "" }: { deadlineAt: string | null; className?: string }) {
  const info = describePaymentDeadline(deadlineAt);
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
        . Si no se registra el pago a la residencia antes, la solicitud vence y se cierra.
      </span>
    </p>
  );
}
