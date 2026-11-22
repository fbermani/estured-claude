import { REVOCATION_WINDOW_DAYS, computeRevocationWindow, type RevocationWindow } from "@/lib/revocations/window";

/**
 * Reglas de negocio de "Resolver revocación" (DR6, docs/00 §31 y docs/04 §8.9) como función PURA: recibe los hechos ya leídos y la
 * entrada del admin, y devuelve el parche a escribir o un error en español. Sin I/O ni `server-only`, para testearla sola
 * (mismo patrón que `recordNegotiationResponse`). `resolveFeeRevocation` hace la lectura y la escritura condicional.
 */

export const REASON_MIN = 10;
export const REASON_MAX = 1000;
export const STUDENT_MESSAGE_MAX = 1000;
export const REFERENCE_MIN = 3;
export const REFERENCE_MAX = 120;
export const REFUND_METHODS = ["bank_transfer", "digital_wallet", "other"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];
export type RevocationDecision = "refunded" | "denied";

const BA_TZ = "America/Argentina/Buenos_Aires";

export type RevocationResolutionInput = {
  decision: string;
  internalReason: string;
  studentMessage: string | null;
  /** Monto que el admin confirmó haber reintegrado (ARS); debe coincidir con el fee. */
  confirmRefundAmountArs: number | null;
  refundMethod: string | null;
  refundReference: string | null;
  /** Fecha del reintegro, `YYYY-MM-DD`. */
  refundedOn: string | null;
  /** DR65 (b): denegar dentro de los 10 días exige marcar que es un pedido duplicado o hecho por error (no un tema de uso del servicio). */
  justifiedCause: boolean;
  /** Confirmación explícita de la denegación (acción irreversible desde la plataforma). */
  confirmDenial: boolean;
  /** Reconocimiento de que un fee pagado en USD se reintegra registrado en ARS (no hay `refund_currency`). Solo se exige si `paymentCurrency = 'USD'`. */
  acknowledgeUsdRefund?: boolean;
};

export type RevocationFacts = {
  reservationStatus: string;
  cancellationReasonCode: string | null;
  /** `reservations.cancelled_at`: cuándo se registró la revocación. */
  revokedAt: string | null;
  feeStatus: string;
  feeAmountArs: number;
  paidAt: string | null;
  revocationResolution: string | null;
  /** `estured_fee_payments.payment_currency` ('ARS' | 'USD'). */
  paymentCurrency?: string | null;
};

export type RevocationResolutionPatch = Record<string, string | number | null>;

export type EvaluateRevocationResult =
  | { ok: true; decision: RevocationDecision; window: RevocationWindow; patch: RevocationResolutionPatch; refundedAtIso: string | null }
  | { ok: false; error: string };

/** `YYYY-MM-DD` de un instante en hora de Buenos Aires. */
export function buenosAiresDateString(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: BA_TZ });
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00-03:00`);
  return !Number.isNaN(date.getTime()) && buenosAiresDateString(date) === value;
}

/** ¿Hay una revocación pendiente de resolver? (reserva revocada + fee `paid` + sin resolución previa). */
export function isRevocationPending(facts: Pick<RevocationFacts, "reservationStatus" | "cancellationReasonCode" | "feeStatus" | "revocationResolution">): boolean {
  return (
    facts.reservationStatus === "cancelled_by_student" &&
    facts.cancellationReasonCode === "student_revocation_right" &&
    facts.feeStatus === "paid" &&
    !facts.revocationResolution
  );
}

export function evaluateRevocationResolution(params: {
  facts: RevocationFacts;
  input: RevocationResolutionInput;
  actorUserId: string;
  now?: Date;
}): EvaluateRevocationResult {
  const { facts, input, actorUserId } = params;
  const now = params.now ?? new Date();

  if (input.decision !== "refunded" && input.decision !== "denied") {
    return { ok: false, error: "Elegí si reintegrás el fee o denegás la revocación." };
  }
  const decision: RevocationDecision = input.decision;

  if (facts.revocationResolution) {
    return { ok: false, error: "Esta revocación ya fue resuelta." };
  }
  if (!isRevocationPending(facts)) {
    return { ok: false, error: "Esta revocación no está pendiente de resolución." };
  }

  const reason = input.internalReason.trim();
  if (reason.length < REASON_MIN) return { ok: false, error: `Escribí un motivo de al menos ${REASON_MIN} caracteres para que quede registrado.` };
  if (reason.length > REASON_MAX) return { ok: false, error: `El motivo no puede superar los ${REASON_MAX} caracteres.` };

  const studentMessage = (input.studentMessage ?? "").trim();
  if (studentMessage.length > STUDENT_MESSAGE_MAX) {
    return { ok: false, error: `El mensaje para el estudiante no puede superar los ${STUDENT_MESSAGE_MAX} caracteres.` };
  }

  if (!facts.paidAt || !facts.revokedAt) {
    return { ok: false, error: "No pudimos determinar la fecha de pago o de revocación de esta reserva." };
  }
  const window = computeRevocationWindow(facts.paidAt, facts.revokedAt);

  const resolutionBase: RevocationResolutionPatch = {
    revocation_resolution: decision,
    revocation_resolved_at: now.toISOString(),
    revocation_resolved_by: actorUserId,
    revocation_internal_reason: reason,
    revocation_student_message: studentMessage || null,
  };

  if (decision === "denied") {
    if (!input.confirmDenial) return { ok: false, error: "Confirmá que querés denegar la revocación." };
    if (window.withinWindow && !input.justifiedCause) {
      return {
        ok: false,
        error: `La revocación se ejerció dentro de los 10 días (día ${window.dayNumber} de ${REVOCATION_WINDOW_DAYS}): el reintegro es incondicional. Solo podés denegarla si es un pedido duplicado o hecho por error; marcalo y explicalo en el motivo.`,
      };
    }
    return { ok: true, decision, window, patch: resolutionBase, refundedAtIso: null };
  }

  // decision === "refunded"
  const confirmed = input.confirmRefundAmountArs;
  if (confirmed === null || !Number.isFinite(confirmed) || Math.abs(confirmed - facts.feeAmountArs) > 0.005) {
    return { ok: false, error: "Confirmá que reintegraste el monto completo del fee (marcá la casilla de confirmación)." };
  }
  if (facts.paymentCurrency === "USD" && !input.acknowledgeUsdRefund) {
    return {
      ok: false,
      error: "Este fee se pagó en USD pero el reintegro se registra en ARS: marcá la casilla de reconocimiento después de confirmar el monto con quien corresponda.",
    };
  }
  if (!input.refundMethod || !(REFUND_METHODS as readonly string[]).includes(input.refundMethod)) {
    return { ok: false, error: "Elegí el medio por el que reintegraste el fee." };
  }
  const reference = (input.refundReference ?? "").trim();
  if (reference.length < REFERENCE_MIN || reference.length > REFERENCE_MAX) {
    return { ok: false, error: `Cargá la referencia del reintegro (entre ${REFERENCE_MIN} y ${REFERENCE_MAX} caracteres).` };
  }
  const refundedOn = (input.refundedOn ?? "").trim();
  if (!isValidDateString(refundedOn)) return { ok: false, error: "Indicá la fecha del reintegro." };
  if (refundedOn > buenosAiresDateString(now)) return { ok: false, error: "La fecha del reintegro no puede ser futura." };
  if (refundedOn < buenosAiresDateString(facts.paidAt)) {
    return { ok: false, error: "La fecha del reintegro no puede ser anterior a la del pago del fee." };
  }
  const refundedAtIso = new Date(`${refundedOn}T12:00:00-03:00`).toISOString();

  return {
    ok: true,
    decision,
    window,
    refundedAtIso,
    patch: {
      ...resolutionBase,
      status: "refunded",
      refunded_at: refundedAtIso,
      refund_amount_ars: facts.feeAmountArs,
      refund_method: input.refundMethod,
      refund_reference: reference,
    },
  };
}
