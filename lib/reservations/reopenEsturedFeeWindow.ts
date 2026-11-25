import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyFamilyReservationMilestone } from "@/lib/family/familyMilestones";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyFeePayer } from "@/lib/payments/feePayerNotices";
import { PROOF_BUCKET } from "@/lib/applications/studentPaymentProof";
import { FEE_REOPEN_CAP_MESSAGE, normalizeReopenCount, reopenCapReached } from "@/lib/payments/reopenCap";

export type ReopenEsturedFeeWindowResult = { status: "ok" } | { status: "error"; message: string };

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
/** El pagador vuelve a elegir el medio. `payment_currency` es NOT NULL con default 'ARS' (migración 0010): no admite null. */
const CLEAR_CHOSEN_METHOD = { chosen_method: null, instructions_snapshot: null, payment_currency: "ARS" } as const;

/**
 * DR64 (d): también reabre un fee en `pending_manual_payment` con «No recibí el pago» abierto (`reopenAfterDispute`): el fee vuelve a
 * `pending_payment_method` con 48 h nuevas y se limpian «Ya pagué», la referencia al comprobante y la disputa. El comprobante en disputa NO se
 * borra: queda en `files` (estado `archived`) como evidencia del caso de Soporte, y su id se guarda en la auditoría. En ambas reaperturas el
 * pagador vuelve a elegir el medio (se limpian `chosen_method`, `instructions_snapshot` y `payment_currency` vuelve a `'ARS'`, su valor por
 * defecto): el medio pudo deshabilitarse o cambiar de datos mientras tanto. La reserva sigue en `pending_estured_fee`.
 *
 * Tope de reaperturas (DR66 (a)): cada reapertura (vencido o tras «No recibí el pago») suma 1 a `estured_fee_payments.reopen_count`, con
 * compare-and-set. Con 2 reaperturas hechas se rechaza: después solo resuelve Soporte.
 *
 * Reabrir la ventana de pago del fee EstuRed de una reserva vencida sin
 * pagar (`expired_fee_unpaid` / `estured_fee_payments.status = 'expired'`)
 * — docs/12 §17 Fase 11: "Admin puede... reintentar... pagos". El propio
 * `expireEsturedFeeWindows.ts` (Ciclo 22) documenta que hoy no hay cobro
 * automático real, así que "reintentar" es esto: dar una ventana manual
 * nueva de 48h (misma regla que la ventana original, docs/00 §9.1),
 * mismo patrón que `reopenApplication.ts`/`reopenRenewalRequest.ts`.
 */
export async function reopenEsturedFeeWindow(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<ReopenEsturedFeeWindowResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo de la reapertura es obligatorio." };

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status, reservation_id, payer_user_id, manual_payment_file_id, admin_disputed_at, reopen_count")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment) return { status: "error", message: "Pago del fee no encontrado." };
  const isDisputed = feePayment.status === "pending_manual_payment" && Boolean(feePayment.admin_disputed_at);
  if (!isDisputed && feePayment.status !== "expired") {
    return { status: "error", message: "Solo se pueden reabrir pagos del fee vencidos o con «No recibí el pago» registrado." };
  }
  const reopenCount = normalizeReopenCount(feePayment.reopen_count);
  if (reopenCapReached(reopenCount)) return { status: "error", message: FEE_REOPEN_CAP_MESSAGE };
  if (isDisputed) return reopenAfterDispute(admin, { ...params, reason }, feePayment as DisputedFee, reopenCount);

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, residences(name)")
    .eq("id", feePayment.reservation_id)
    .maybeSingle();
  if (!reservation || reservation.status !== "expired_fee_unpaid") {
    return { status: "error", message: "La reserva asociada no está en un estado vencido reabrible." };
  }

  const newExpiresAt = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString();
  const { data: reopenedFee, error: feeUpdateError } = await admin
    .from("estured_fee_payments")
    .update({ status: "pending_payment_method", expires_at: newExpiresAt, reopen_count: reopenCount + 1, admin_escalated_at: null, ...CLEAR_CHOSEN_METHOD })
    .eq("id", feePayment.id)
    .eq("status", "expired")
    .eq("reopen_count", reopenCount)
    .select("id");
  if (feeUpdateError) {
    console.error("[reservations] reopenEsturedFeeWindow fee update failed:", feeUpdateError.code, feeUpdateError.message);
    return { status: "error", message: "No pudimos reabrir el pago. Probá de nuevo." };
  }
  // Sin fila actualizada (otra reapertura o el cron ganaron): no se toca la reserva, para que fee y reserva no queden desalineados.
  if (!reopenedFee || reopenedFee.length === 0) {
    return { status: "error", message: "El pago cambió mientras lo revisabas. Recargá la pantalla para ver su estado actual." };
  }

  const { error: reservationUpdateError } = await admin
    .from("reservations")
    .update({ status: "pending_estured_fee" })
    .eq("id", reservation.id)
    .eq("status", "expired_fee_unpaid");
  if (reservationUpdateError) {
    console.error("[reservations] reopenEsturedFeeWindow reservation update failed:", reservationUpdateError.code, reservationUpdateError.message);
    return { status: "error", message: "No pudimos reabrir la reserva. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_window_reopened_by_admin",
    entityType: "estured_fee_payments",
    entityId: feePayment.id,
    oldValue: { status: "expired" },
    newValue: { status: "pending_payment_method", expires_at: newExpiresAt, reopen_count: reopenCount + 1 },
    reasonText: reason,
    source: "admin",
  });

  const residenceName = (reservation.residences as unknown as { name: string } | null)?.name ?? "tu residencia";
  await createNotification(admin, {
    category: "payments_fee",
    userId: feePayment.payer_user_id,
    title: "Te dieron otra chance para pagar el fee EstuRed",
    body: `El equipo de EstuRed reabrió el pago del fee para tu reserva en ${residenceName} — tenés 48hs más. Motivo: ${reason}`,
    relatedEntityType: "reservations",
    relatedEntityId: reservation.id,
  });
  // DR4: el familiar vinculado también se entera del nuevo plazo (sin repetirle el aviso si él es el pagador).
  await notifyFamilyReservationMilestone(admin, reservation.id, "fee_to_pay", { excludeUserIds: [feePayment.payer_user_id] });

  return { status: "ok" };
}

type DisputedFee = { id: string; status: string; reservation_id: string | null; payer_user_id: string; manual_payment_file_id: string | null };

/**
 * Conserva el comprobante del fee en disputa como evidencia del caso de Soporte: NO borra la fila de `files` ni el objeto del bucket; la
 * marca `archived` (reemplazada por el nuevo intento). Solo toca un archivo del bucket de comprobantes que sea de ESE fee. Mejor esfuerzo.
 * Devuelve `true` si el archivo es de ese fee (y quedó conservado).
 */
async function archiveDisputedProof(admin: SupabaseClient, fileId: string, feeId: string): Promise<boolean> {
  const { data: file } = await admin.from("files").select("id, bucket, related_entity_type, related_entity_id").eq("id", fileId).maybeSingle();
  if (!file || file.bucket !== PROOF_BUCKET || file.related_entity_type !== "estured_fee_payments" || file.related_entity_id !== feeId) return false;
  const { error } = await admin.from("files").update({ status: "archived" }).eq("id", fileId);
  if (error) console.error("[reservations] reopenEsturedFeeWindow: no se pudo archivar el comprobante en disputa:", error.code, error.message);
  return true;
}

async function reopenAfterDispute(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string; actorRole: string; reason: string },
  fee: DisputedFee,
  reopenCount: number,
): Promise<ReopenEsturedFeeWindowResult> {
  if (!fee.reservation_id) return { status: "error", message: "Solo se puede reabrir el pago de una reserva inicial." };
  const { data: reservation } = await admin.from("reservations").select("id, status").eq("id", fee.reservation_id).maybeSingle();
  if (!reservation || reservation.status !== "pending_estured_fee") {
    return { status: "error", message: "La reserva ya no está esperando el pago del fee. Recargá la pantalla." };
  }

  const newExpiresAt = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString();
  // Compare-and-set por el estado y el comprobante leídos: si el admin validó o el pagador cambió algo mientras tanto, no pisa nada.
  let query = admin
    .from("estured_fee_payments")
    .update({
      status: "pending_payment_method",
      expires_at: newExpiresAt,
      student_reported_paid_at: null,
      manual_payment_file_id: null,
      reopen_count: reopenCount + 1,
      admin_disputed_at: null,
      admin_dispute_reason: null,
      admin_disputed_by_user_id: null,
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
      admin_escalated_at: null,
      ...CLEAR_CHOSEN_METHOD,
    })
    .eq("id", fee.id)
    .eq("status", "pending_manual_payment")
    .eq("reopen_count", reopenCount)
    .not("admin_disputed_at", "is", null);
  query = fee.manual_payment_file_id ? query.eq("manual_payment_file_id", fee.manual_payment_file_id) : query.is("manual_payment_file_id", null);
  const { data: updated, error } = await query.select("id");
  if (error) {
    console.error("[reservations] reopenEsturedFeeWindow (disputa) update failed:", error.code, error.message);
    return { status: "error", message: "No pudimos reabrir el pago. Probá de nuevo." };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", message: "El pago cambió mientras lo revisabas. Recargá la pantalla para ver su estado actual." };
  }
  // La referencia ya se limpió; el archivo se conserva (evidencia del caso de Soporte) y su id queda en la auditoría.
  const keptProofFileId = fee.manual_payment_file_id && (await archiveDisputedProof(admin, fee.manual_payment_file_id, fee.id)) ? fee.manual_payment_file_id : null;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_payment_reopened_after_dispute",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    oldValue: { status: "pending_manual_payment", disputed: true, disputed_proof_file_id: keptProofFileId },
    newValue: { status: "pending_payment_method", expires_at: newExpiresAt, reservation_id: fee.reservation_id, reopen_count: reopenCount + 1 },
    reasonText: params.reason,
    source: "admin",
  });
  await notifyFeePayer(admin, { payerUserId: fee.payer_user_id, kind: "reopened_after_dispute", related: { type: "reservations", id: fee.reservation_id } });
  return { status: "ok" };
}
