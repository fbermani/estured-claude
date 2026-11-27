"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ivaConditionLabel, paymentChannelLabel } from "@/lib/format/payerLabels";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatShortName } from "@/lib/format/shortName";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import { reservationReference, type FeeCountdown } from "@/lib/payments/feeTransferPresentation";
import { describeFeeCalculation } from "@/lib/payments/feeCalculation";
import {
  AMOUNT_FLOOR_RATIO,
  AMBIGUOUS_AMOUNT_ERROR,
  REASON_MIN,
  REASON_STRICT_MIN,
  compareReceivedAmount,
  expectedAmountFor,
  isAmbiguousAmountText,
  parseReceivedAmount,
} from "@/lib/payments/evaluateManualFeePayment";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { cmd } from "@/components/admin/ui/tokens";
import { markFeePaidManually, type MarkFeePaidState } from "@/app/admin/payments/actions";
import { DisputeFeeForm, IssueResponseForm, ReopenAfterDisputeForm } from "@/app/admin/payments/FeeReviewActions";
import { Input, Select, Textarea } from "@/components/ui/Input";

interface FeePayment {
  id: string;
  status: string;
  fee_amount_ars: number;
  fee_amount_usd: number | null;
  fee_rate_percent: number | null;
  fee_base_usd: number;
  fee_base_ars: number;
  expires_at: string | null;
  payment_channel: string | null;
  reservation_id: string | null;
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

/**
 * Lo que el admin ve de DR64 (medio elegido, «Ya pagué», «No pude realizar el pago», «No recibí el pago»). Se arma en el servidor: las
 * fechas ya vienen formateadas (sin desincronizar la hidratación) y NUNCA viajan los datos de cobro congelados, solo el nombre del medio.
 */
export type FeeReview = {
  chosenLabel: string | null;
  currency: string | null;
  reportedPaidLabel: string | null;
  issue: { reason: string | null; atLabel: string } | null;
  dispute: { reason: string | null; atLabel: string } | null;
  /** DR66 (a): el pago ya se reabrió 2 veces; «Reabrir el pago» se deshabilita (solo Soporte). */
  reopenLimitReached: boolean;
};

export type FeePayer = { name: string | null; role: "student" | "family" | "unknown" };

const initialState: MarkFeePaidState = { status: "idle" };

const payerRoleLabel: Record<FeePayer["role"], string> = {
  student: "Estudiante",
  family: "Familiar",
  unknown: "Pagador",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt style={{ color: cmd.outline }}>{label}</dt>
      <dd className="min-w-0 break-words text-right" style={{ color: cmd.onSurface }}>
        {children}
      </dd>
    </div>
  );
}

export function PaymentDetail({
  feePayment,
  proofFileId,
  payer,
  countdown,
  isSuperadmin,
  review,
}: {
  feePayment: FeePayment;
  proofFileId: string | null;
  payer: FeePayer;
  countdown: FeeCountdown | null;
  review: FeeReview;
  /** Rol de la sesión: solo un superadmin puede confirmar si se recibió menos del 90 % del fee. */
  isSuperadmin: boolean;
}) {
  const reservation = feePayment.reservations;
  const calc = describeFeeCalculation({
    feeBaseUsd: Number(feePayment.fee_base_usd),
    feeBaseArs: Number(feePayment.fee_base_ars),
    feeAmountArs: Number(feePayment.fee_amount_ars),
    feeAmountUsd: feePayment.fee_amount_usd === null ? null : Number(feePayment.fee_amount_usd),
    feeRatePercent: feePayment.fee_rate_percent === null ? null : Number(feePayment.fee_rate_percent),
  });
  const hasReceipt = Boolean(proofFileId) && feePayment.status === "pending_manual_payment";
  // Hay un archivo cargado pero el pagador no terminó de informar el pago (sigue en `pending_payment_method`): ni se confirma ni se ofrece el override.
  const receiptNotInReview = Boolean(proofFileId) && feePayment.status !== "pending_manual_payment";
  const isReported = feePayment.status === "pending_manual_payment";
  const disputed = isReported && review.dispute !== null;
  const issueOpen = feePayment.status === "pending_payment_method" && review.issue !== null;
  const stageBadge = disputed
    ? { label: "No recibido", tone: "rose" as const }
    : issueOpen
      ? { label: "No pudo pagar", tone: "rose" as const }
      : hasReceipt
        ? { label: "Esperando validación", tone: "violet" as const }
        : { label: "Sin comprobante", tone: "amber" as const };

  return (
    <div className="max-w-2xl space-y-6">
      <AdminCard className="p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-lg font-bold" style={{ color: cmd.onSurface }}>
            {formatShortName(reservation?.student_profiles?.first_name, reservation?.student_profiles?.last_initial)} —{" "}
            {reservation?.residences?.name}
          </h2>
          <AdminBadge tone={stageBadge.tone}>{stageBadge.label}</AdminBadge>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {feePayment.reservation_id && (
            <Row label="Referencia de la transferencia">
              <span className="font-mono font-bold">{reservationReference(feePayment.reservation_id)}</span>
            </Row>
          )}
          <Row label="Pagador">
            {payer.name ? `${payer.name} · ` : ""}
            <strong>{payerRoleLabel[payer.role]}</strong>
            {payer.role === "family" && " (no es el estudiante)"}
          </Row>
          <Row label="Plazo para pagar">
            {isReported ? (
              <span>
                <strong>Sin vencimiento</strong>
                <span className="block text-xs font-normal" style={{ color: cmd.outline }}>
                  El pagador ya informó el pago a tiempo
                </span>
              </span>
            ) : issueOpen ? (
              <span>
                <strong>En pausa</strong>
                <span className="block text-xs font-normal" style={{ color: cmd.outline }}>
                  Vuelve a correr cuando respondas el aviso
                </span>
              </span>
            ) : countdown ? (
              <span style={{ color: countdown.expired ? cmd.rose : countdown.urgent ? cmd.amber : cmd.onSurface }}>
                <strong>{countdown.expired ? "Vencido" : `Vence en ${countdown.remaining}`}</strong>
                <span className="block text-xs font-normal" style={{ color: cmd.outline }}>
                  {countdown.expired ? "Venció el" : "Hasta el"} {countdown.absolute}
                </span>
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Fecha de ingreso">{formatDateOnly(reservation?.start_date)}</Row>
          <Row label="Medio elegido">
            {review.chosenLabel ? `${review.chosenLabel}${review.currency ? ` · ${review.currency}` : ""}` : paymentChannelLabel(feePayment.payment_channel)}
          </Row>
          {review.reportedPaidLabel && <Row label="El pagador avisó que pagó">{review.reportedPaidLabel}</Row>}
          <Row label="Facturar a">
            {feePayment.payer_billing_name ?? "—"} {feePayment.payer_billing_cuit ? `(${feePayment.payer_billing_cuit})` : ""}
          </Row>
          <Row label="Condición IVA">{ivaConditionLabel(feePayment.payer_iva_condition)}</Row>
        </dl>

        <div className="mt-5 rounded-lg p-3 text-sm" style={{ backgroundColor: cmd.surfaceContainer }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Cómo se calculó el fee
          </p>
          <p className="mt-1.5" style={{ color: cmd.onSurface }}>
            Base {formatUsd(calc.baseUsd)} × {calc.ratePercent.toLocaleString("es-AR")} %
            {calc.arsPerUsd ? ` × tipo de cambio del snapshot ARS ${calc.arsPerUsd.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : ""}
          </p>
          <p className="mt-1" style={{ color: cmd.onSurfaceVariant }}>
            Base en pesos: {formatArs(calc.baseArs)} · el {calc.ratePercent.toLocaleString("es-AR")} % da {formatArs(calc.exactArs)} exactos, redondeados a múltiplos de 500.
          </p>
          <p className="mt-2 font-bold" style={{ color: cmd.onSurface }}>
            Fee a cobrar: {formatArs(calc.feeArs)}
            {calc.feeUsd !== null && <span className="font-normal"> · equivale a {formatUsd(calc.feeUsd)}</span>}
          </p>
        </div>

        {proofFileId ? (
          <div className="mt-4">
            <DocumentAccessButton fileId={proofFileId} label="Ver comprobante subido →" />
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay comprobante subido por quien paga.
          </p>
        )}
      </AdminCard>

      {issueOpen && review.issue && (
        <IssueResponseForm
          feePaymentId={feePayment.id}
          canContact={Boolean(feePayment.reservation_id)}
          issueReason={review.issue.reason}
          reopenLimitReached={review.reopenLimitReached}
        />
      )}
      {disputed && review.dispute && <ReopenAfterDisputeForm feePaymentId={feePayment.id} disputeReason={review.dispute.reason} reopenLimitReached={review.reopenLimitReached} />}

      <ValidationCard
        feePaymentId={feePayment.id}
        hasReceipt={hasReceipt}
        receiptFileId={proofFileId}
        receiptNotInReview={receiptNotInReview}
        isSuperadmin={isSuperadmin}
        // DR64 (d): el plazo solo bloquea en `pending_payment_method`; un pago ya informado no vence. Con un aviso abierto la salida es «Reabrir el pago» (arriba).
        expired={Boolean(countdown?.expired) && feePayment.status === "pending_payment_method" && !issueOpen}
        // Con medio elegido, el pago se valida en la moneda que eligió el pagador (el servidor lo exige).
        initialCurrency={review.currency === "USD" ? "USD" : "ARS"}
        expected={{
          feeAmountArs: calc.feeArs,
          feeAmountUsd: feePayment.fee_amount_usd === null ? null : Number(feePayment.fee_amount_usd),
          feeBaseUsd: Number(feePayment.fee_base_usd),
          feeBaseArs: Number(feePayment.fee_base_ars),
        }}
      />
      {hasReceipt && proofFileId && !disputed && <DisputeFeeForm feePaymentId={feePayment.id} receiptFileId={proofFileId} />}
    </div>
  );
}

type Expected = { feeAmountArs: number; feeAmountUsd: number | null; feeBaseUsd: number; feeBaseArs: number };

function ValidationCard({
  feePaymentId,
  hasReceipt,
  receiptFileId,
  receiptNotInReview,
  isSuperadmin,
  expired,
  initialCurrency,
  expected,
}: {
  feePaymentId: string;
  initialCurrency: "ARS" | "USD";
  hasReceipt: boolean;
  /** `manual_payment_file_id` que se está viendo: se reenvía oculto para que el servidor confirme que no cambió. */
  receiptFileId: string | null;
  receiptNotInReview: boolean;
  isSuperadmin: boolean;
  expired: boolean;
  expected: Expected;
}) {
  // El estado del formulario vive en React (controlado): así el texto escrito no se pierde si el servidor rechaza
  // (React 19 resetea los campos no controlados después de cada acción).
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [ackNoReceipt, setAckNoReceipt] = useState(false);
  const [acceptDiff, setAcceptDiff] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [state, formAction] = useActionState(async (prev: MarkFeePaidState, formData: FormData) => {
    const result = await markFeePaidManually(feePaymentId, prev, formData);
    // Los checkboxes de confirmación se desmarcan tras un rechazo (el reset del formulario los limpia en el DOM): hay que
    // volver a verificar y confirmar a propósito, y el estado de React queda alineado con lo que se ve.
    if (result.status === "error") {
      setVerified(false);
      setAckNoReceipt(false);
      setAcceptDiff(false);
    }
    return result;
  }, initialState);

  if (state.status === "saved") {
    return (
      <AdminCard className="p-4 md:p-6">
        <p role="status" className="text-sm font-medium" style={{ color: cmd.emerald }}>
          Pago validado. Reserva confirmada y comprobante generado.
        </p>
      </AdminCard>
    );
  }

  if (expired) {
    return (
      <AdminCard className="p-4 md:p-6">
        <p role="alert" className="text-sm font-bold" style={{ color: cmd.rose }}>
          El plazo para pagar este fee venció: no se puede marcar como pagado.
        </p>
        <p className="mt-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Si corresponde, reabrí el plazo (se da una ventana nueva de 48 h al pagador) y después validá el pago.
        </p>
        <Link href="/admin/activity?tab=reservations" className="mt-3 inline-block text-sm font-bold underline" style={{ color: cmd.primary }}>
          Reabrir el plazo desde Actividad → Reservas
        </Link>
      </AdminCard>
    );
  }

  if (receiptNotInReview) {
    return (
      <AdminCard className="p-4 md:p-6">
        <h3 className="text-base font-bold" style={{ color: cmd.onSurface }}>
          Validar el pago
        </h3>
        <p role="status" className="mt-2 text-sm font-medium" style={{ color: cmd.amber }}>
          El pago todavía no pasó a revisión manual.
        </p>
        <p className="mt-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Ya hay un comprobante cargado, pero quien paga no terminó de informar el pago. Cuando lo haga, va a aparecer acá para validarlo. No
          se puede confirmar sin comprobante mientras haya uno cargado.
        </p>
      </AdminCard>
    );
  }

  const withoutReceipt = !hasReceipt;
  const intent = withoutReceipt ? "confirm_without_receipt" : "confirm";
  const formVisible = hasReceipt || overrideOpen;
  // El override solo se ofrece si NO hay comprobante cargado (con `receiptNotInReview` ya se salió arriba).

  const parsedAmount = parseReceivedAmount(amount);
  const ambiguousAmount = isAmbiguousAmountText(amount);
  const expectedForCurrency = expectedAmountFor(currency, expected);
  const comparison =
    parsedAmount !== null && parsedAmount > 0 && expectedForCurrency !== null ? compareReceivedAmount(expectedForCurrency, parsedAmount) : null;
  const outOfTolerance = comparison !== null && !comparison.withinTolerance;
  const floorBlocked = comparison !== null && comparison.belowFloor && !isSuperadmin;
  const strictReason = withoutReceipt || outOfTolerance;
  const reasonMin = strictReason ? REASON_STRICT_MIN : REASON_MIN;
  const money = (value: number) => (currency === "USD" ? formatUsd(value) : formatArs(value));

  const goToConfirm = () => {
    if (ambiguousAmount) {
      setLocalError(AMBIGUOUS_AMOUNT_ERROR);
      return;
    }
    if (parsedAmount === null || parsedAmount < 0.005) {
      setLocalError("Cargá el monto realmente recibido antes de continuar.");
      return;
    }
    if (floorBlocked) {
      setLocalError(`Recibiste menos del ${Math.round(AMOUNT_FLOOR_RATIO * 100)} % del fee esperado: solo un superadmin puede confirmarlo.`);
      return;
    }
    if (reason.trim().length < reasonMin) {
      setLocalError(`Escribí el motivo (al menos ${reasonMin} caracteres) antes de continuar.`);
      return;
    }
    setLocalError(null);
    setStep("confirm");
  };

  return (
    <form action={formAction}>
      {hasReceipt && receiptFileId && <input type="hidden" name="receipt_file_id" value={receiptFileId} />}
      <AdminCard className="p-4 md:p-6">
        <h3 className="text-base font-bold" style={{ color: cmd.onSurface }}>
          Validar el pago
        </h3>

        {!hasReceipt && (
          <div className="mt-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
            <p>
              Todavía no hay comprobante cargado, así que <strong>no se puede marcar como pagado</strong>. Esperá a que lo suban.
            </p>
            {!overrideOpen && (
              <button
                type="button"
                onClick={() => setOverrideOpen(true)}
                className="mt-3 text-xs font-bold underline"
                style={{ color: cmd.rose }}
              >
                Confirmar sin comprobante (excepcional)
              </button>
            )}
          </div>
        )}

        {formVisible && (
          <>
            {withoutReceipt && (
              <p className="mt-3 rounded-lg p-3 text-sm font-medium" style={{ backgroundColor: cmd.roseBg, color: cmd.rose }}>
                Vas a validar este pago <strong>sin comprobante</strong>. Es una excepción: queda marcado en el registro del pago y en la
                auditoría, y necesita un motivo de al menos {REASON_STRICT_MIN} caracteres.
              </p>
            )}

            <div className={step === "edit" ? "" : "hidden"}>
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  label="Monto recibido"
                  id="received_amount"
                  name="received_amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 140500 o 140500,50"
                  className="min-w-0 flex-1 basis-40"
                />
                <Select
                  label="Moneda"
                  name="payment_currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-28 shrink-0"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: cmd.outline }}>
                Fee esperado: {expectedForCurrency !== null ? money(expectedForCurrency) : "no se puede calcular en esta moneda"}
              </p>
              {ambiguousAmount && (
                <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: cmd.rose }}>
                  {AMBIGUOUS_AMOUNT_ERROR}
                </p>
              )}
              {comparison && (
                <p
                  role="status"
                  className="mt-1 text-xs font-semibold"
                  style={{ color: comparison.exact ? cmd.emerald : comparison.withinTolerance ? cmd.amber : cmd.rose }}
                >
                  {comparison.exact
                    ? "Coincide con el fee esperado."
                    : `Diferencia: ${comparison.difference > 0 ? "+" : "−"}${money(Math.abs(comparison.difference))} (${(comparison.differenceRatio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %). ${
                        comparison.withinTolerance
                          ? "Está dentro de la tolerancia del 1 % (redondeo)."
                          : `Supera el 1 %: explicala en el motivo (al menos ${REASON_STRICT_MIN} caracteres) y tildá que aceptás la diferencia.`
                      }`}
                </p>
              )}
              {floorBlocked && (
                <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: cmd.rose }}>
                  Es menos del {Math.round(AMOUNT_FLOOR_RATIO * 100)} % del fee esperado: solo un superadmin puede confirmar un pago así. Derivalo.
                </p>
              )}

              <Input
                label="Referencia del pago (opcional)"
                id="payment_provider_reference"
                name="payment_provider_reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Ej: últimos 4 dígitos, número de operación"
                className="mt-4"
              />

              <Textarea
                label="Motivo (obligatorio)"
                hint={`Notas de la validación. Al menos ${reasonMin} caracteres.`}
                id="reason"
                name="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                placeholder={
                  withoutReceipt
                    ? "Ej: el pagador mostró el movimiento en el home banking por soporte; no pudo subir el archivo"
                    : "Ej: el comprobante de transferencia coincide con el monto y la referencia"
                }
                className="mt-4"
              />

              {localError && (
                <p role="alert" className="mt-3 text-sm font-medium" style={{ color: cmd.rose }}>
                  {localError}
                </p>
              )}
              <AdminButton type="button" variant="primary" className="mt-4" onClick={goToConfirm} disabled={floorBlocked}>
                Revisar y confirmar
              </AdminButton>
              {withoutReceipt && (
                <AdminButton type="button" variant="ghost" className="ml-2 mt-4" onClick={() => setOverrideOpen(false)}>
                  Cancelar
                </AdminButton>
              )}
            </div>

            {step === "confirm" && (
              <div className="mt-4">
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: cmd.surfaceContainer, color: cmd.onSurface }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                    Estás por confirmar
                  </p>
                  <p className="mt-1.5">
                    Monto recibido: <strong>{parsedAmount !== null ? money(parsedAmount) : "—"}</strong>
                    {expectedForCurrency !== null && <> (esperado {money(expectedForCurrency)})</>}
                  </p>
                  {comparison && !comparison.exact && (
                    <p className="mt-1" style={{ color: comparison.withinTolerance ? cmd.amber : cmd.rose }}>
                      Diferencia de {(comparison.differenceRatio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} % contra el fee esperado.
                    </p>
                  )}
                  <p className="mt-1">Comprobante: {withoutReceipt ? "sin comprobante (excepción)" : "cargado"}</p>
                </div>
                <p className="mt-3 text-sm font-medium" style={{ color: cmd.onSurface }}>
                  Al confirmar se <strong>confirma la reserva</strong>, se <strong>emite el comprobante de reserva</strong> y se{" "}
                  <strong>dispara la factura</strong>. No se puede deshacer desde acá.
                </p>

                {outOfTolerance && (
                  <label className="mt-3 flex items-start gap-2 text-sm font-medium" style={{ color: cmd.rose }}>
                    <input
                      type="checkbox"
                      name="accept_amount_difference"
                      checked={acceptDiff}
                      onChange={(e) => setAcceptDiff(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      Acepto que el monto recibido difiere más del 1 % del fee esperado
                      {comparison?.belowFloor ? " (menos del 90 %: confirmación de superadmin)" : ""}
                    </span>
                  </label>
                )}
                <label className="mt-3 flex items-start gap-2 text-sm" style={{ color: cmd.onSurface }}>
                  <input
                    type="checkbox"
                    name="verified"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>Verifiqué el pago</span>
                </label>
                {withoutReceipt && (
                  <label className="mt-2 flex items-start gap-2 text-sm" style={{ color: cmd.rose }}>
                    <input
                      type="checkbox"
                      name="confirm_without_receipt"
                      checked={ackNoReceipt}
                      onChange={(e) => setAckNoReceipt(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>Confirmo que valido este pago sin comprobante y que quedará marcado en la auditoría</span>
                  </label>
                )}

                {state.status === "error" && (
                  <p role="alert" className="mt-3 text-sm font-medium" style={{ color: cmd.rose }}>
                    {state.message}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ConfirmButton
                    intent={intent}
                    disabled={!verified || (withoutReceipt && !ackNoReceipt) || (outOfTolerance && !acceptDiff) || floorBlocked}
                    withoutReceipt={withoutReceipt}
                  />
                  <BackButton onClick={() => setStep("edit")} />
                </div>
              </div>
            )}
          </>
        )}
      </AdminCard>
    </form>
  );
}

/** Submit nativo con `name`/`value` (no `onClick` + `setState`: condición de carrera) y estado de envío vía `useFormStatus`. */
function ConfirmButton({ intent, disabled, withoutReceipt }: { intent: string; disabled: boolean; withoutReceipt: boolean }) {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" name="intent" value={intent} variant={withoutReceipt ? "danger" : "primary"} disabled={disabled || pending}>
      {pending ? "Confirmando…" : withoutReceipt ? "Confirmar sin comprobante y confirmar reserva" : "Marcar pagado y confirmar reserva"}
    </AdminButton>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="button" variant="secondary" onClick={onClick} disabled={pending}>
      Volver a editar
    </AdminButton>
  );
}
