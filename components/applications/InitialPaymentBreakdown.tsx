import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import { formatDate } from "@/lib/dates/format";

/**
 * Desglose "qué pagás y a quién" (D7 / H08): "A la residencia: USD X antes
 * de [fecha] · A EstuRed: fee USD Y". Son dos pagos distintos y a destinos
 * distintos — el pago inicial para reservar va directo a la residencia y el
 * fee lo cobra EstuRed solo si la reserva se confirma (docs/00 §12).
 *
 * Presentación pura: los montos salen del snapshot (`reservation_payment_amount_*`
 * y fee estimado) o de la previa de `ApplyForm`; los pesos son referenciales.
 * `deadlineAt` recién existe cuando la residencia habilita el pago
 * (`application_requests.payment_deadline_at`); antes se explica cuándo aparece.
 */
export function InitialPaymentBreakdown({
  residenceUsd,
  residenceArs,
  deadlineAt,
  feeUsd,
  feeArs,
  residencePaid = false,
  className = "",
}: {
  residenceUsd: number;
  residenceArs?: number | null;
  /** Fecha límite del pago a la residencia (ISO), si ya fue habilitado. */
  deadlineAt?: string | null;
  feeUsd?: number | null;
  feeArs?: number | null;
  /** La residencia ya informó haber recibido el pago inicial: se oculta la fecha límite. */
  residencePaid?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-field border border-line bg-paper px-4 py-3 text-sm ${className}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Qué pagás y a quién</p>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">A la residencia</p>
          <p className="text-xs text-ink-faint">
            {residencePaid
              ? "Pago inicial para reservar, ya informado."
              : deadlineAt
                ? `Pago inicial para reservar, antes del ${formatDate(deadlineAt)}.`
                : "Pago inicial para reservar. La fecha límite aparece cuando la residencia habilita el pago."}
          </p>
        </div>
        <p className="text-right font-bold text-ink">
          {formatUsd(residenceUsd)}
          {residenceArs != null && (
            <span className="block text-xs font-normal text-ink-soft">
              ≈ {formatArs(residenceArs)}
              <ExchangeRateNote />
            </span>
          )}
        </p>
      </div>

      {feeUsd != null && feeUsd > 0 && (
        <div className="mt-3 flex items-start justify-between gap-4 border-t border-line pt-3">
          <div>
            <p className="font-semibold text-ink">A EstuRed: fee</p>
            <p className="text-xs text-ink-faint">5% de la estadía inicial. Solo se abona si la residencia confirma la reserva.</p>
          </div>
          <p className="text-right font-bold text-ink">
            {formatUsd(feeUsd)}
            {feeArs != null && (
              <span className="block text-xs font-normal text-ink-soft">
                ≈ {formatArs(feeArs)}
                <ExchangeRateNote />
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
