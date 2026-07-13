import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type ReopenEsturedFeeWindowResult = { status: "ok" } | { status: "error"; message: string };

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
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
    .select("id, status, reservation_id, payer_user_id")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment) return { status: "error", message: "Pago del fee no encontrado." };
  if (feePayment.status !== "expired") {
    return { status: "error", message: "Solo se pueden reabrir pagos del fee vencidos." };
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
    userId: feePayment.payer_user_id,
    title: "Te dieron otra chance para pagar el fee EstuRed",
    body: `El equipo de EstuRed reabrió el pago del fee para tu reserva en ${residenceName} — tenés 48hs más. Motivo: ${reason}`,
    relatedEntityType: "reservations",
    relatedEntityId: reservation.id,
  });

  return { status: "ok" };
}
