import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyFamilyReservationMilestone } from "@/lib/family/familyMilestones";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyFeePayer } from "@/lib/payments/feePayerNotices";
import { discardStoredProof, PROOF_BUCKET } from "@/lib/applications/studentPaymentProof";

export type ReopenEsturedFeeWindowResult = { status: "ok" } | { status: "error"; message: string };

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * DR64 (d): también reabre un fee en `pending_manual_payment` con «No recibí el pago» abierto (`reopenAfterDispute`): el fee vuelve a
 * `pending_payment_method` con 48 h nuevas, se limpian «Ya pagué», el comprobante y la disputa, y se descarta el comprobante anterior.
 * La reserva sigue en `pending_estured_fee`. El tope de reaperturas está propuesto y NO implementado (`docs/00` DR64 (i)).
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
    .select("id, status, reservation_id, payer_user_id, manual_payment_file_id, admin_disputed_at")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment) return { status: "error", message: "Pago del fee no encontrado." };
  if (feePayment.status === "pending_manual_payment" && feePayment.admin_disputed_at) {
    return reopenAfterDispute(admin, { ...params, reason }, feePayment as DisputedFee);
  }
  if (feePayment.status !== "expired") {
    return { status: "error", message: "Solo se pueden reabrir pagos del fee vencidos o con «No recibí el pago» registrado." };
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, residences(name)")
    .eq("id", feePayment.reservation_id)
    .maybeSingle();
  if (!reservation || reservation.status !== "expired_fee_unpaid") {
    return { status: "error", message: "La reserva asociada no está en un estado vencido reabrible." };
  }

  const newExpiresAt = new Date(Date.now() + FORTY_EIGHT_HOURS_MS).toISOString();
  const { error: feeUpdateError } = await admin
    .from("estured_fee_payments")
    .update({ status: "pending_payment_method", expires_at: newExpiresAt })
    .eq("id", feePayment.id)
    .eq("status", "expired");
  if (feeUpdateError) {
    console.error("[reservations] reopenEsturedFeeWindow fee update failed:", feeUpdateError);
    return { status: "error", message: "No pudimos reabrir el pago. Probá de nuevo." };
  }

  const { error: reservationUpdateError } = await admin
    .from("reservations")
    .update({ status: "pending_estured_fee" })
    .eq("id", reservation.id)
    .eq("status", "expired_fee_unpaid");
  if (reservationUpdateError) {
    console.error("[reservations] reopenEsturedFeeWindow reservation update failed:", reservationUpdateError);
    return { status: "error", message: "No pudimos reabrir la reserva. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_window_reopened_by_admin",
    entityType: "estured_fee_payments",
    entityId: feePayment.id,
    oldValue: { status: "expired" },
    newValue: { status: "pending_payment_method", expires_at: newExpiresAt },
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

/** Descarta el comprobante del fee reabierto. Solo toca un archivo del bucket de comprobantes que sea de ESE fee. Mejor esfuerzo. */
async function discardFeeProof(admin: SupabaseClient, fileId: string, feeId: string): Promise<void> {
  const { data: file } = await admin.from("files").select("id, bucket, storage_path, related_entity_type, related_entity_id").eq("id", fileId).maybeSingle();
  if (!file || file.bucket !== PROOF_BUCKET || file.related_entity_type !== "estured_fee_payments" || file.related_entity_id !== feeId) return;
  await discardStoredProof(admin, { fileId, storagePath: file.storage_path as string });
}

async function reopenAfterDispute(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string; actorRole: string; reason: string },
  fee: DisputedFee,
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
      admin_disputed_at: null,
      admin_dispute_reason: null,
      admin_disputed_by_user_id: null,
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
    })
    .eq("id", fee.id)
    .eq("status", "pending_manual_payment")
    .not("admin_disputed_at", "is", null);
  query = fee.manual_payment_file_id ? query.eq("manual_payment_file_id", fee.manual_payment_file_id) : query.is("manual_payment_file_id", null);
  const { data: updated, error } = await query.select("id");
  if (error) {
    console.error("[reservations] reopenEsturedFeeWindow (disputa) update failed:", error);
    return { status: "error", message: "No pudimos reabrir el pago. Probá de nuevo." };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", message: "El pago cambió mientras lo revisabas. Recargá la pantalla para ver su estado actual." };
  }
  // Primero se limpia la referencia (FK) y recién después se descarta el archivo.
  if (fee.manual_payment_file_id) await discardFeeProof(admin, fee.manual_payment_file_id, fee.id);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "estured_fee_payment_reopened_after_dispute",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    oldValue: { status: "pending_manual_payment", disputed: true },
    newValue: { status: "pending_payment_method", expires_at: newExpiresAt, reservation_id: fee.reservation_id },
    reasonText: params.reason,
    source: "admin",
  });
  await notifyFeePayer(admin, { payerUserId: fee.payer_user_id, kind: "reopened_after_dispute", related: { type: "reservations", id: fee.reservation_id } });
  return { status: "ok" };
}
