import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";

export type RetryReservationConfirmationResult = { ok: true } | { ok: false; error: string };

/**
 * Ciclo 71 (DR8) — "Reintentar confirmación": el fee figura `paid` pero la reserva sigue en `pending_estured_fee` (la confirmación falló
 * después de marcar el pago). Solo se llama desde una server action que ya comprobó rol admin/superadmin. NO vuelve a validar ni a
 * mover plata: solo reintenta `confirmReservationAfterFeePaid`, que es idempotente (UPDATE condicional de la reserva; si ya estaba
 * confirmada no duplica comprobante ni factura). Siempre audita el reintento (quién, resultado).
 */
export async function retryReservationConfirmation(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string; actorRole: "admin" | "superadmin" },
): Promise<RetryReservationConfirmationResult> {
  const { data: feePayment, error: feeError } = await admin
    .from("estured_fee_payments")
    .select("id, status, reservation_id, renewal_offer_id")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (feeError) {
    console.error("[admin-payments] retry: fee query failed:", feeError);
    return { ok: false, error: "No pudimos leer el pago. Probá de nuevo." };
  }
  if (!feePayment) return { ok: false, error: "No encontramos ese pago." };
  if (feePayment.renewal_offer_id || !feePayment.reservation_id) {
    return { ok: false, error: "Este pago no corresponde a una reserva inicial." };
  }
  if (feePayment.status !== "paid") return { ok: false, error: "Este pago no figura como pagado: no hay nada que reintentar." };

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id, status")
    .eq("id", feePayment.reservation_id)
    .maybeSingle();
  if (reservationError) {
    console.error("[admin-payments] retry: reservation query failed:", reservationError);
    return { ok: false, error: "No pudimos leer la reserva. Probá de nuevo." };
  }
  if (!reservation) return { ok: false, error: "No encontramos la reserva asociada." };
  if (reservation.status !== "pending_estured_fee") {
    return { ok: false, error: "La reserva ya no está esperando la confirmación. Recargá la pantalla." };
  }

  const result = await confirmReservationAfterFeePaid(admin, {
    feePaymentId: params.feePaymentId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
  });

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "reservation_confirmation_retried",
    entityType: "estured_fee_payments",
    entityId: params.feePaymentId,
    newValue: { reservation_id: feePayment.reservation_id, succeeded: result.ok, ...(result.ok ? {} : { error: result.error }) },
    source: "admin",
  });

  if (!result.ok) {
    console.error("[admin-payments] retry confirmReservationAfterFeePaid failed:", result.error);
    return { ok: false, error: `No se pudo confirmar la reserva: ${result.error}` };
  }
  return { ok: true };
}
