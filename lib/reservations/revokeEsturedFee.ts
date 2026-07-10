import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

const REVOCATION_WINDOW_DAYS = 10;

export type RevokeEsturedFeeResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/07 §18.6, docs/08 §6.9bis, docs/10 §15.4 (DECISIÓN CONFIRMADA) —
 * derecho de revocación del fee EstuRed dentro de los 10 días corridos
 * desde el pago (requisito legal de contratación a distancia, no una
 * feature opcional). El fee **permanece `paid`** — nunca pasa a
 * `refunded` automáticamente; el eventual reembolso es una decisión
 * admin posterior, fuera de alcance de esta función.
 *
 * **Simplificación deliberada, no descuido**: docs/07 §18.6 dice que la
 * revocación "abre un `support_case` interno" para que el admin revise
 * patrones de bypass — `support_cases` no existe como feature en el
 * proyecto (ningún flujo de soporte real construido todavía, mismo
 * criterio ya aplicado en `/admin/verifications` con el "Trust Score" y
 * en `/admin/family-proposals` con la derivación a soporte: no simular
 * una acción sin la infraestructura real detrás). La auditoría completa
 * en `audit_logs` cumple el propósito real (que quede registrado y sea
 * revisable) sin inventar una tabla de casos de soporte completa.
 */
export async function revokeEsturedFee(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    actorUserId: string;
    reason: string | null;
    acknowledgeNoAutomaticRefund: boolean;
  },
): Promise<RevokeEsturedFeeResult> {
  if (!params.acknowledgeNoAutomaticRefund) {
    return { ok: false, error: "Tenés que confirmar que entendés que no hay reembolso automático." };
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, student_profile_id, estured_fee_payment_id, booking_receipt_id")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (!reservation) return { ok: false, error: "No encontramos esa reserva." };
  if (!reservation.estured_fee_payment_id) return { ok: false, error: "Esta reserva no tiene un fee pagado." };

  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status, paid_at, payer_user_id")
    .eq("id", reservation.estured_fee_payment_id)
    .single();
  if (!feePayment) return { ok: false, error: "No encontramos el pago del fee de esta reserva." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  const isOwner = studentProfile?.id === reservation.student_profile_id;
  const isPayer = feePayment.payer_user_id === params.actorUserId;
  if (!isOwner && !isPayer) return { ok: false, error: "Esta reserva no te pertenece." };

  if (reservation.status !== "confirmed") {
    return { ok: false, error: "Esta reserva no está en un estado que permita revocar el fee." };
  }
  if (feePayment.status !== "paid") {
    return { ok: false, error: "El fee de esta reserva todavía no está pagado." };
  }
  if (!feePayment.paid_at) {
    return { ok: false, error: "No pudimos determinar la fecha de pago del fee." };
  }

  const daysSincePaid = (Date.now() - new Date(feePayment.paid_at).getTime()) / (24 * 3_600_000);
  if (daysSincePaid >= REVOCATION_WINDOW_DAYS) {
    return { ok: false, error: "El plazo de 10 días corridos para revocar el fee ya venció." };
  }

  const now = new Date().toISOString();

  const { error: reservationError } = await admin
    .from("reservations")
    .update({
      status: "cancelled_by_student",
      cancellation_reason_code: "student_revocation_right",
      cancelled_at: now,
    })
    .eq("id", reservation.id);
  if (reservationError) {
    console.error("[revocation] reservation update failed:", reservationError);
    return { ok: false, error: "No pudimos registrar la revocación. Intentá de nuevo." };
  }

  if (reservation.booking_receipt_id) {
    await admin
      .from("booking_receipts")
      .update({ status: "voided", voided_at: now })
      .eq("id", reservation.booking_receipt_id);
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: isOwner ? "student" : "family_member",
    action: "estured_fee_revoked",
    entityType: "reservations",
    entityId: reservation.id,
    reasonText: params.reason ?? undefined,
    newValue: { estured_fee_payment_id: feePayment.id, days_since_paid: Math.floor(daysSincePaid) },
    source: "user",
  });

  return { ok: true };
}
