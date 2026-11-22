import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog, alertAdminsOfAuditFailure, notifyAdmins } from "@/lib/audit";
import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";
import { isMissingFeeAuditColumnError } from "@/lib/payments/feePaymentSchema";
import {
  evaluateManualFeePayment,
  validateManualFeeInput,
  type ManualFeeFacts,
} from "@/lib/payments/evaluateManualFeePayment";

export type RecordManualFeePaymentResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/07 §17.4 + DR8 (docs/00 §31, docs/04 §8.10) — admin valida un pago manual del fee EstuRed. Exige comprobante cargado o el
 * override "Confirmar sin comprobante" (motivo ≥ 10 + segunda confirmación), el monto realmente recibido (comparado contra el fee
 * guardado, tolerancia 1 %), el checkbox "Verifiqué el pago" y que el plazo siga vigente. Dispara la confirmación de reserva +
 * generación de comprobante en la misma operación (docs/07 §18.2), vía `confirmReservationAfterFeePaid` (sin cambios de semántica).
 *
 * Capa de I/O sobre `evaluateManualFeePayment` (reglas puras): valida la entrada sin tocar la DB, lee el fee/la reserva/el pago a la
 * residencia, evalúa, escribe con un UPDATE CONDICIONAL (estado, plazo y estado del comprobante) con chequeo de filas afectadas — la
 * segunda confirmación simultánea no pisa nada —, audita (quién, esperado vs. recibido, diferencia, override; sin datos de facturación)
 * y confirma la reserva. Solo se llama desde una server action que ya comprobó rol admin/superadmin.
 *
 * Extraído del server action (Ciclo 19, GAPS.md) para que la lógica de negocio sea testeable sin `next/headers`.
 *
 * Ciclo 71 (revisión): el UPDATE condicional exige exactamente lo que se evaluó (el mismo estado del fee, el mismo comprobante por
 * id, plazo vigente o sin plazo); si el fee queda `paid` pero la confirmación de la reserva falla, se audita
 * `reservation_confirmation_failed_after_fee_paid`, se avisa a los admins y la pantalla de Cobrados ofrece "Reintentar confirmación".
 *
 * Migración 0050: el monto recibido, `confirmed_without_receipt` y `validated_by_user_id` se guardan en la fila del pago. Si la 0050 todavía
 * no está aplicada, el UPDATE se repite sin esas columnas y los datos quedan solo en el audit log (el pago funciona igual).
 */
export async function recordManualFeePayment(
  admin: SupabaseClient,
  params: {
    feePaymentId: string;
    reason: string;
    paymentCurrency: string;
    /** Monto realmente recibido, tal como llegó del formulario. */
    receivedAmount: string | number | null;
    providerReference: string | null;
    /** `confirm` (con comprobante) o `confirm_without_receipt` (override). */
    intent: string;
    /** Segunda confirmación del override. */
    confirmWithoutReceipt: boolean;
    /** Checkbox "Verifiqué el pago". */
    verified: boolean;
    /** Checkbox "Acepto la diferencia de monto" (obligatorio fuera de la tolerancia del 1 %). */
    acceptAmountDifference: boolean;
    /** `manual_payment_file_id` que el admin tenía en pantalla (campo oculto del form). Obligatorio al confirmar con comprobante. */
    seenReceiptFileId: string | null;
    actorUserId: string;
    actorRole: "admin" | "superadmin";
    now?: Date;
  },
): Promise<RecordManualFeePaymentResult> {
  const input = {
    reason: params.reason,
    receivedAmount: params.receivedAmount,
    paymentCurrency: params.paymentCurrency,
    intent: params.intent,
    confirmWithoutReceipt: params.confirmWithoutReceipt,
    verified: params.verified,
    acceptAmountDifference: params.acceptAmountDifference,
  };
  // Primero lo que no depende de la base: si la entrada es inválida no se lee nada.
  const early = validateManualFeeInput(input);
  if (!early.ok) return early;

  const { data: feePayment, error: feeError } = await admin
    .from("estured_fee_payments")
    .select(
      "id, status, expires_at, manual_payment_file_id, fee_amount_ars, fee_amount_usd, fee_base_usd, fee_base_ars, reservation_id, renewal_offer_id, admin_disputed_at, chosen_method, payment_currency",
    )
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (feeError) {
    console.error("[admin-payments] fee query failed:", feeError);
    return { ok: false, error: "No pudimos leer el pago. Probá de nuevo." };
  }
  if (!feePayment) return { ok: false, error: "No encontramos ese pago." };
  if (feePayment.renewal_offer_id || !feePayment.reservation_id) {
    return { ok: false, error: "Este pago no corresponde a una reserva inicial." };
  }

  // DR64: con un medio elegido, el monto se compara en la moneda de ESE medio (la fija `payment_currency` al elegirlo). Sin medio elegido
  // (fee anterior a DR64 o validación directa) `payment_currency` es solo el valor por defecto y no obliga.
  if (feePayment.chosen_method && feePayment.payment_currency && feePayment.payment_currency !== params.paymentCurrency) {
    return {
      ok: false,
      error: `El pagador eligió un medio en ${feePayment.payment_currency}. Registrá el monto recibido en esa moneda para compararlo con el fee.`,
    };
  }

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id, status, external_residence_payment_id")
    .eq("id", feePayment.reservation_id)
    .maybeSingle();
  if (reservationError) {
    console.error("[admin-payments] reservation query failed:", reservationError);
    return { ok: false, error: "No pudimos leer el pago. Probá de nuevo." };
  }
  let residencePaymentStatus: string | null = null;
  if (reservation?.external_residence_payment_id) {
    const { data: residencePayment, error: residencePaymentError } = await admin
      .from("external_residence_payments")
      .select("status")
      .eq("id", reservation.external_residence_payment_id)
      .maybeSingle();
    if (residencePaymentError) {
      console.error("[admin-payments] residence payment query failed:", residencePaymentError);
      return { ok: false, error: "No pudimos leer el pago. Probá de nuevo." };
    }
    residencePaymentStatus = (residencePayment?.status as string | undefined) ?? null;
  }

  const facts: ManualFeeFacts = {
    feeStatus: feePayment.status as string,
    hasReceipt: Boolean(feePayment.manual_payment_file_id),
    expiresAt: (feePayment.expires_at as string | null) ?? null,
    feeAmountArs: Number(feePayment.fee_amount_ars),
    feeAmountUsd: feePayment.fee_amount_usd === null || feePayment.fee_amount_usd === undefined ? null : Number(feePayment.fee_amount_usd),
    feeBaseUsd: Number(feePayment.fee_base_usd),
    feeBaseArs: Number(feePayment.fee_base_ars),
    reservationStatus: (reservation?.status as string | undefined) ?? null,
    residencePaymentStatus,
  };
  const now = params.now ?? new Date();
  const evaluation = evaluateManualFeePayment({ facts, input, actorRole: params.actorRole, now });
  if (!evaluation.ok) return evaluation;
  const { plan } = evaluation;

  // El comprobante que el admin tenía en pantalla tiene que ser el que hay ahora (pudo reemplazarse mientras lo revisaba).
  const receiptFileId = (feePayment.manual_payment_file_id as string | null) ?? null;
  if (plan.hadReceipt && !plan.confirmedWithoutReceipt && params.seenReceiptFileId !== receiptFileId) {
    return { ok: false, error: "El comprobante cambió mientras lo revisabas. Recargá la pantalla y revisalo de nuevo antes de confirmar." };
  }

  const basePatch = {
    status: "paid",
    payment_provider: "manual",
    payment_currency: plan.paymentCurrency,
    provider_payment_id: params.providerReference,
    paid_at: now.toISOString(),
  };
  const extraPatch = {
    received_amount: plan.receivedAmount,
    confirmed_without_receipt: plan.confirmedWithoutReceipt,
    validated_by_user_id: params.actorUserId,
  };

  // Update condicional que coincide con lo evaluado: mismo estado del fee que se leyó, plazo vigente (o sin plazo) y el mismo
  // comprobante (por id) o ninguno. Solo gana quien encuentra el pago exactamente así; la segunda confirmación no pisa nada.
  // DR64 (d): el plazo se exige solo en `pending_payment_method`; en `pending_manual_payment` ya se informó a tiempo y no se revisa.
  // Si había «No recibí el pago» abierto, validar la limpia (los tres campos van juntos por el CHECK de 0105). Validar DESPUÉS de una
  // disputa sigue permitido (DR8 no cambia: el admin puede encontrar el pago más tarde). Lo que se evita es la carrera inversa: el update
  // exige el MISMO `admin_disputed_at` que se leyó (nulo o ese valor), así una disputa que entra mientras se valida no queda pisada en silencio.
  const hadDispute = Boolean(feePayment.admin_disputed_at);
  const disputeClear = hadDispute ? { admin_disputed_at: null, admin_dispute_reason: null, admin_disputed_by_user_id: null } : {};
  const conditionalUpdate = (patch: Record<string, unknown>) => {
    let query = admin.from("estured_fee_payments").update({ ...patch, ...disputeClear }).eq("id", params.feePaymentId).eq("status", facts.feeStatus);
    if (facts.feeStatus === "pending_payment_method") query = query.or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
    query = plan.hadReceipt ? query.eq("manual_payment_file_id", receiptFileId as string) : query.is("manual_payment_file_id", null);
    query = hadDispute ? query.eq("admin_disputed_at", feePayment.admin_disputed_at as string) : query.is("admin_disputed_at", null);
    return query.select("id");
  };

  let storedOnRow = true;
  let { data: updatedRows, error: updateError } = await conditionalUpdate({ ...basePatch, ...extraPatch });
  if (updateError && isMissingFeeAuditColumnError(updateError)) {
    // Migración 0050 sin aplicar: el pago se valida igual; el monto recibido y el override quedan solo en el audit log.
    storedOnRow = false;
    ({ data: updatedRows, error: updateError } = await conditionalUpdate(basePatch));
  }
  if (updateError) {
    console.error("[admin-payments] mark-paid failed:", updateError);
    return { ok: false, error: "No pudimos guardar el pago." };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return {
      ok: false,
      error: "Este pago ya fue procesado, cambió mientras lo revisabas o su plazo venció. Recargá la pantalla para ver su estado actual.",
    };
  }

  // Un solo reason_code compatible con el audit existente; si se dan las dos condiciones se listan juntas (sin perder la diferencia).
  const reasonCodes = [
    ...(plan.confirmedWithoutReceipt ? ["confirmed_without_receipt"] : []),
    ...(!plan.withinTolerance ? ["amount_difference"] : []),
  ];
  const reasonCode = reasonCodes.length > 0 ? reasonCodes.join(",") : undefined;
  const audited = await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_marked_paid_manually",
    entityType: "estured_fee_payments",
    entityId: params.feePaymentId,
    reasonCode,
    reasonText: plan.reason,
    oldValue: { status: facts.feeStatus },
    // Sin datos de facturación (CUIT/DNI/nombre del pagador) ni la referencia completa del pago.
    newValue: {
      reservation_id: feePayment.reservation_id,
      expected_amount: plan.expectedAmount,
      received_amount: plan.receivedAmount,
      currency: plan.paymentCurrency,
      difference: plan.difference,
      difference_percent: Math.round(plan.differenceRatio * 10000) / 100,
      amount_within_tolerance: plan.withinTolerance,
      amount_exact: plan.exact,
      amount_difference_accepted: plan.amountDifferenceAccepted,
      below_floor: plan.belowFloor,
      had_receipt: plan.hadReceipt,
      confirmed_without_receipt: plan.confirmedWithoutReceipt,
      provider_reference_set: Boolean(params.providerReference),
      stored_on_payment_row: storedOnRow,
    },
    source: "admin",
  });
  if (!audited) {
    await alertAdminsOfAuditFailure(admin, {
      action: "estured_fee_marked_paid_manually",
      entityType: "estured_fee_payments",
      entityId: params.feePaymentId,
    });
  }

  const result = await confirmReservationAfterFeePaid(admin, {
    feePaymentId: params.feePaymentId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
  });
  if (!result.ok) {
    console.error("[admin-payments] confirmReservationAfterFeePaid failed:", params.feePaymentId, result.error);
    // El fee YA quedó `paid` y no se revierte (revertir dinero es más riesgoso): se deja constancia, se avisa a los admins y la
    // pantalla de Cobrados marca el caso con "Reintentar confirmación".
    const auditedFailure = await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "reservation_confirmation_failed_after_fee_paid",
      entityType: "estured_fee_payments",
      entityId: params.feePaymentId,
      newValue: { reservation_id: feePayment.reservation_id, error: result.error },
      source: "admin",
    });
    if (!auditedFailure) console.error("[admin-payments] could not audit confirmation failure for fee", params.feePaymentId);
    await notifyAdmins(admin, {
      title: "Fee cobrado con la reserva sin confirmar",
      body: `El pago ${params.feePaymentId.slice(0, 8)} se registró como pagado, pero la reserva no se pudo confirmar. Reintentá la confirmación desde Pagos fee → Cobrados.`,
      entityType: "estured_fee_payments",
      entityId: params.feePaymentId,
    });
    return {
      ok: false,
      error: `Pago marcado, pero falló la confirmación de la reserva: ${result.error} Reintentá desde Pagos fee → Cobrados («Reintentar confirmación»).`,
    };
  }

  return { ok: true };
}
