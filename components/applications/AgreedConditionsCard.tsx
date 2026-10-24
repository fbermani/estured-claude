import { Card } from "@/components/ui/Card";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd, roundArs } from "@/lib/mock/exchange";
import type { AgreedConditions } from "@/lib/applications/agreedConditions";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { InitialPaymentBreakdown } from "@/components/applications/InitialPaymentBreakdown";
import { estimatedFeeUsd } from "@/lib/reservations/initialPayment";

type Row = { label: string; value: React.ReactNode; hint?: string };

/**
 * Condiciones de una solicitud, siempre desde el snapshot (H07). El título
 * distingue lo ya acordado de lo solicitado, para no decir "acordado" antes
 * de tiempo (H24). Los montos en pesos son referenciales y se acompañan con
 * el tipo de cambio del snapshot (docs/00 §13, docs/08 §2.8).
 */
export function AgreedConditionsCard({
  conditions,
  agreed,
  feeRealArs,
  feeIsPaid,
  residencePaymentReported,
  residencePaymentDeadlineAt,
  terminal = false,
}: {
  conditions: AgreedConditions;
  /** La solicitud ya pasó por la aceptación de condiciones (docs/04 §5.2). */
  agreed: boolean;
  /** Fee EstuRed real (`estured_fee_payments.fee_amount_ars`), si ya se generó el pago. */
  feeRealArs?: number | null;
  feeIsPaid?: boolean;
  /** Monto que la residencia informó como recibido (`external_residence_payments`), si lo hay. */
  residencePaymentReported?: { usd: number | null; ars: number | null } | null;
  /** Fecha límite del pago a la residencia (`payment_deadline_at`); solo en `residence_payment_pending`. */
  residencePaymentDeadlineAt?: string | null;
  /** La solicitud terminó: sin estimaciones ni plazos de pago como si siguiera. */
  terminal?: boolean;
}) {
  const pair = (usd: number | null, ars: number | null) =>
    usd === null ? "—" : (
      <>
        {formatUsd(usd)}
        {ars !== null && <span className="text-ink-soft"> · ≈ {formatArs(roundArs(ars))}</span>}
      </>
    );

  const feeUsd = conditions.feeBaseUsd !== null ? estimatedFeeUsd(conditions.feeBaseUsd) : null;
  const feeBreakdownArs = feeRealArs ?? conditions.estimatedFeeArs ?? null;

  const rows: Row[] = [
    { label: "Tarifa mensual", value: pair(conditions.monthlyUsd, conditions.monthlyArs) },
    {
      label: "Duración inicial",
      value: conditions.durationMonths ? `${conditions.durationMonths} meses` : "—",
    },
  ];
  if (conditions.enrollmentUsd !== null)
    rows.push({
      label: "Matrícula (no reembolsable)",
      value: pair(conditions.enrollmentUsd, conditions.enrollmentArs),
    });
  if (conditions.depositUsd !== null)
    rows.push({ label: "Depósito (reembolsable)", value: pair(conditions.depositUsd, conditions.depositArs) });
  if (conditions.adjustmentPolicyLabel) rows.push({ label: "Política de ajustes", value: conditions.adjustmentPolicyLabel });
  if (residencePaymentReported && (residencePaymentReported.usd !== null || residencePaymentReported.ars !== null))
    rows.push({
      label: "Pago informado por la residencia",
      value: pair(residencePaymentReported.usd, residencePaymentReported.ars),
    });
  if (conditions.feeBaseUsd !== null && !terminal)
    rows.push({
      label: "Base del fee EstuRed",
      value: pair(conditions.feeBaseUsd, conditions.feeBaseArs),
      hint: "Estadía inicial + matrícula. El depósito no entra.",
    });
  const feeArs = feeRealArs ?? conditions.estimatedFeeArs;
  const hasRealFee = feeRealArs !== null && feeRealArs !== undefined;
  if (feeArs !== null && feeArs !== undefined && (!terminal || hasRealFee))
    rows.push({
      label: feeRealArs !== null && feeRealArs !== undefined ? (feeIsPaid ? "Fee EstuRed pagado (5%)" : "Fee EstuRed (5%)") : "Fee EstuRed estimado (5%)",
      value: formatArs(feeArs),
    });

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-base font-bold text-ink">
        {agreed && !terminal ? "Condiciones acordadas" : "Condiciones de la solicitud"}
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        {terminal
          ? "La solicitud terminó: estos montos quedan como referencia de lo que se había planteado."
          : conditions.isFinal
          ? "Son las condiciones finales que se aceptaron después del ajuste propuesto."
          : agreed
            ? "Son las condiciones con las que se envió la solicitud."
            : "Son las condiciones vigentes cuando se envió la solicitud. Si la residencia las cambia después, esta solicitud no se modifica."}
      </p>
      {conditions.initialPaymentUsd !== null && !terminal && (
        <InitialPaymentBreakdown
          className="mt-4"
          residenceUsd={conditions.initialPaymentUsd}
          residenceArs={
            conditions.initialPaymentArs !== null ? roundArs(conditions.initialPaymentArs) : null
          }
          deadlineAt={residencePaymentDeadlineAt}
          residencePaid={!!residencePaymentReported}
          feeUsd={feeUsd}
          feeArs={feeBreakdownArs}
        />
      )}
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 border-b border-sand-200 pb-2 last:border-b-0 last:pb-0">
            <dt className="text-ink-faint">
              {row.label}
              {row.hint && <span className="block text-xs">{row.hint}</span>}
            </dt>
            <dd className="text-right font-medium text-ink">{row.value}</dd>
          </div>
        ))}
        {conditions.exchangeRate !== null && (
          <div className="flex justify-between gap-4 border-t border-sand-200 pt-3">
            <dt className="text-ink-faint">Tipo de cambio de referencia</dt>
            <dd className="text-right font-medium text-ink">
              {formatArs(conditions.exchangeRate)} por USD
              {conditions.exchangeRateDate && (
                <span className="block text-xs font-normal text-ink-faint">
                  al {formatDateOnly(conditions.exchangeRateDate)}
                  <ExchangeRateNote />
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
