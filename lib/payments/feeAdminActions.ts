import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { validateDisputeReason, validateResolveReason } from "@/lib/payments/feeAdminLimits";
import { isFeeIssueOpen } from "@/lib/payments/feeCollection";
import { openFeeReviewSupportCase } from "@/lib/payments/feeSupportCase";
import { notifyFeePayer } from "@/lib/payments/feePayerNotices";
import { FEE_REOPEN_CAP_MESSAGE, normalizeReopenCount, reopenCapReached } from "@/lib/payments/reopenCap";

/**
 * Acciones del ADMIN sobre un fee de EstuRed en revisión (DR64 (d) y (e); `docs/07` §17.9). Capa de negocio `(admin, params)` sin
 * `next/headers`: la usa `app/admin/payments/actions.ts`, que ya comprobó rol admin/superadmin con la sesión.
 *
 *  - `disputeFeePaymentCore` («No recibí el pago»): marca `admin_disputed_*` sin cambiar el estado del fee ni de la reserva, abre el caso de
 *    Soporte y avisa al pagador. No es un estado nuevo (`docs/04` §8.8).
 *  - `resolveFeePaymentIssueCore` (responde «No pude realizar el pago»): «Contactar al pagador» o «Reabrir el pago». Ambas cierran el
 *    aviso y reinician el plazo de 48 h.
 * Los avisos no llevan el motivo ni datos de cobro. La auditoría guarda el motivo del admin en `reason_text` (no datos de cobro).
 * Tope de reaperturas (DR66 (a)): «Reabrir el pago» cuenta en `reopen_count` (máximo 2); «Contactar al pagador» no cuenta.
 */

export type FeeAdminResult = { ok: true } | { ok: false; error: string };

export const FEE_WINDOW_MS = 48 * 60 * 60 * 1000;
const SAVE_FAILED = "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.";
const STALE = "El pago cambió mientras lo revisabas. Recargá la pantalla para ver su estado actual.";
const NOT_FOUND = "No encontramos ese pago.";

const CLEAR_MARKS = { payer_reminder_sent_at: null, admin_reminder_sent_at: null, admin_alert_sent_at: null, admin_escalated_at: null } as const;

type Actor = { actorUserId: string; actorRole: "admin" | "superadmin" };

type FeeRow = {
  id: string;
  status: string;
  reservation_id: string | null;
  renewal_offer_id: string | null;
  payer_user_id: string;
  expires_at: string | null;
  manual_payment_file_id: string | null;
  admin_disputed_at: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
  chosen_method: string | null;
  payer_reminder_sent_at: string | null;
  admin_reminder_sent_at: string | null;
  admin_alert_sent_at: string | null;
  admin_escalated_at: string | null;
  reopen_count: number | null;
};
const FEE_COLUMNS =
  "id, status, reservation_id, renewal_offer_id, payer_user_id, expires_at, manual_payment_file_id, admin_disputed_at, student_payment_issue_at, student_payment_issue_resolved_at, chosen_method, payer_reminder_sent_at, admin_reminder_sent_at, admin_alert_sent_at, admin_escalated_at, reopen_count";

async function loadFee(admin: SupabaseClient, feePaymentId: string): Promise<{ fee: FeeRow | null; failed: boolean }> {
  const { data, error } = await admin.from("estured_fee_payments").select(FEE_COLUMNS).eq("id", feePaymentId).maybeSingle();
  if (error) {
    console.error("[fee-admin] fee read failed:", error.code, error.message);
    return { fee: null, failed: true };
  }
  return { fee: (data as FeeRow | null) ?? null, failed: false };
}

/** «No recibí el pago»: el admin no encuentra el pago que el pagador informó. */
export async function disputeFeePaymentCore(
  admin: SupabaseClient,
  params: Actor & { feePaymentId: string; reason: unknown; seenReceiptFileId: string | null; now?: Date },
): Promise<FeeAdminResult> {
  const reason = validateDisputeReason(params.reason);
  if (!reason.ok) return reason;
  const now = params.now ?? new Date();

  const { fee, failed } = await loadFee(admin, params.feePaymentId);
  if (failed) return { ok: false, error: SAVE_FAILED };
  if (!fee) return { ok: false, error: NOT_FOUND };
  if (fee.renewal_offer_id || !fee.reservation_id) return { ok: false, error: "Este pago no corresponde a una reserva inicial." };
  if (fee.status !== "pending_manual_payment") return { ok: false, error: "Solo se puede registrar «No recibí el pago» sobre un pago que el pagador ya informó." };
  if (fee.admin_disputed_at) return { ok: false, error: "Este pago ya tiene registrado «No recibí el pago»." };
  if (!fee.manual_payment_file_id) return { ok: false, error: "El pago informado no tiene comprobante. Revisalo antes de continuar." };
  if (params.seenReceiptFileId !== fee.manual_payment_file_id) {
    return { ok: false, error: "El comprobante cambió mientras lo revisabas. Recargá la pantalla y revisalo de nuevo." };
  }

  const { data: reservation, error: reservationError } = await admin.from("reservations").select("id, status").eq("id", fee.reservation_id).maybeSingle();
  if (reservationError) {
    console.error("[fee-admin] reservation read failed:", reservationError.code, reservationError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!reservation || reservation.status !== "pending_estured_fee") return { ok: false, error: "La reserva ya no está esperando el pago del fee. Recargá la pantalla." };

  // Compare-and-set: solo gana quien encuentra el pago informado, con ese comprobante y sin disputa. Un segundo toque no hace nada.
  const { data: claimed, error: claimError } = await admin
    .from("estured_fee_payments")
    .update({ admin_disputed_at: now.toISOString(), admin_dispute_reason: reason.value, admin_disputed_by_user_id: params.actorUserId })
    .eq("id", fee.id)
    .eq("status", "pending_manual_payment")
    .eq("manual_payment_file_id", fee.manual_payment_file_id)
    .is("admin_disputed_at", null)
    .select("id");
  if (claimError) {
    console.error("[fee-admin] dispute claim failed:", claimError.code, claimError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: STALE };

  const supportCase = await openFeeReviewSupportCase(admin, {
    reservationId: fee.reservation_id,
    payerUserId: fee.payer_user_id,
    description: "EstuRed no pudo confirmar el pago del fee que el pagador informó. Soporte revisa el caso con el comprobante cargado.",
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
  });
  if (!supportCase.ok) {
    // Sin el caso el pagador queda sin canal: se deshace la marca y se pide reintentar.
    await admin
      .from("estured_fee_payments")
      .update({ admin_disputed_at: null, admin_dispute_reason: null, admin_disputed_by_user_id: null })
      .eq("id", fee.id)
      .eq("status", "pending_manual_payment")
      .eq("admin_disputed_by_user_id", params.actorUserId);
    return { ok: false, error: "No pudimos abrir el caso de Soporte. Intentá de nuevo en unos minutos." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_payment_disputed",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    newValue: { reservation_id: fee.reservation_id, chosen_method: fee.chosen_method, support_case_id: supportCase.supportCaseId },
    reasonText: reason.value,
    source: "admin",
  });
  await notifyFeePayer(admin, { payerUserId: fee.payer_user_id, kind: "disputed", related: { type: "reservations", id: fee.reservation_id } });
  return { ok: true };
}

export type FeeIssueResolution = "contact_payer" | "reopen_payment";

/** Respuesta del admin a «No pude realizar el pago». Cierra el aviso y reinicia el plazo de 48 h. */
export async function resolveFeePaymentIssueCore(
  admin: SupabaseClient,
  params: Actor & { feePaymentId: string; resolution: unknown; reason: unknown; now?: Date },
): Promise<FeeAdminResult> {
  if (params.resolution !== "contact_payer" && params.resolution !== "reopen_payment") {
    return { ok: false, error: "La opción no es válida. Recargá la página e intentá de nuevo." };
  }
  const resolution: FeeIssueResolution = params.resolution;
  const reason = validateResolveReason(params.reason);
  if (!reason.ok) return reason;
  const now = params.now ?? new Date();

  const { fee, failed } = await loadFee(admin, params.feePaymentId);
  if (failed) return { ok: false, error: SAVE_FAILED };
  if (!fee) return { ok: false, error: NOT_FOUND };
  if (fee.status !== "pending_payment_method" || !isFeeIssueOpen(fee)) return { ok: false, error: "El pagador no tiene un aviso de pago abierto." };
  if (resolution === "contact_payer" && (fee.renewal_offer_id || !fee.reservation_id)) {
    return { ok: false, error: "En una renovación solo se puede reabrir el pago." };
  }

  if (fee.reservation_id) {
    const { data: reservation } = await admin.from("reservations").select("id, status").eq("id", fee.reservation_id).maybeSingle();
    if (!reservation || reservation.status !== "pending_estured_fee") return { ok: false, error: "La reserva ya no está esperando el pago del fee. Recargá la pantalla." };
  }

  // DR66 (a): máximo 2 reaperturas por pago. Solo «Reabrir el pago» cuenta.
  const reopenCount = normalizeReopenCount(fee.reopen_count);
  if (resolution === "reopen_payment" && reopenCapReached(reopenCount)) return { ok: false, error: FEE_REOPEN_CAP_MESSAGE };

  const newExpiresAt = new Date(now.getTime() + FEE_WINDOW_MS).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("estured_fee_payments")
    .update({
      student_payment_issue_resolved_at: now.toISOString(),
      expires_at: newExpiresAt,
      ...(resolution === "reopen_payment" ? { reopen_count: reopenCount + 1 } : {}),
      ...CLEAR_MARKS,
    })
    .eq("id", fee.id)
    .eq("reopen_count", reopenCount)
    .eq("status", "pending_payment_method")
    .eq("student_payment_issue_at", fee.student_payment_issue_at as string)
    .is("student_payment_issue_resolved_at", null)
    .select("id");
  if (claimError) {
    console.error("[fee-admin] issue resolve claim failed:", claimError.code, claimError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: STALE };

  let supportCaseId: string | null = null;
  if (resolution === "contact_payer" && fee.reservation_id) {
    const supportCase = await openFeeReviewSupportCase(admin, {
      reservationId: fee.reservation_id,
      payerUserId: fee.payer_user_id,
      description: "El pagador avisó que no pudo realizar el pago del fee EstuRed. Soporte lo contacta para ayudarlo.",
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
    });
    if (!supportCase.ok) {
      // Se devuelve el aviso a «abierto» con el plazo y las marcas que tenía, para poder reintentar.
      await admin
        .from("estured_fee_payments")
        .update({
          student_payment_issue_resolved_at: null,
          expires_at: fee.expires_at,
          payer_reminder_sent_at: fee.payer_reminder_sent_at,
          admin_reminder_sent_at: fee.admin_reminder_sent_at,
          admin_alert_sent_at: fee.admin_alert_sent_at,
          admin_escalated_at: fee.admin_escalated_at,
        })
        .eq("id", fee.id)
        .eq("student_payment_issue_resolved_at", now.toISOString());
      return { ok: false, error: "No pudimos abrir el caso de Soporte. Intentá de nuevo en unos minutos." };
    }
    supportCaseId = supportCase.supportCaseId;
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_payment_issue_resolved",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    newValue: {
      resolution,
      expires_at: newExpiresAt,
      chosen_method: fee.chosen_method,
      support_case_id: supportCaseId,
      reopen_count: resolution === "reopen_payment" ? reopenCount + 1 : reopenCount,
    },
    reasonText: reason.value,
    source: "admin",
  });
  const related = fee.reservation_id
    ? ({ type: "reservations", id: fee.reservation_id } as const)
    : ({ type: "renewal_offers", id: fee.renewal_offer_id as string } as const);
  await notifyFeePayer(admin, { payerUserId: fee.payer_user_id, kind: resolution === "contact_payer" ? "issue_contact" : "issue_reopen", related });
  return { ok: true };
}
