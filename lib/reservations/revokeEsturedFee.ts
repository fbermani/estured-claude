import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertAdminsOfAuditFailure, createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { REVOCATION_WINDOW_DAYS, daysBetween } from "@/lib/revocations/window";
import { openFeeRevocationSupportCase } from "@/lib/revocations/openRevocationSupportCase";
import { REVOCATION_ADULT_STUDENT_ONLY_ERROR } from "@/lib/revocations/copy";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

export type RevokeEsturedFeeResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/07 §18.6, docs/08 §6.9bis, docs/10 §15.4 (DECISIÓN CONFIRMADA, actualizada por DR6) —
 * derecho de revocación del fee EstuRed dentro de los 10 días corridos
 * desde el pago (requisito legal de contratación a distancia, no una
 * feature opcional). El fee **permanece `paid`** — nunca pasa a
 * `refunded` automáticamente: dentro del plazo EstuRed reintegra el fee
 * completo, pero previa resolución del admin con motivo obligatorio
 * (`resolveFeeRevocation`, fuera de alcance de esta función).
 *
 * Al revocar se abre un caso de Soporte `fee_revocation` (docs/07 §18.6,
 * `openFeeRevocationSupportCase`) en modo best-effort: si falla (p. ej.
 * migración 0049 sin aplicar) la revocación igual queda registrada y
 * auditada; el admin la ve en Actividad → Revocaciones.
 */
export async function revokeEsturedFee(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    actorUserId: string;
    reason: string | null;
    /** Checkbox único de entendimiento de las consecuencias (DR6). */
    acknowledgeUnderstanding: boolean;
  },
): Promise<RevokeEsturedFeeResult> {
  if (!params.acknowledgeUnderstanding) {
    return { ok: false, error: "Tenés que confirmar que entendiste qué pasa al revocar el fee." };
  }

  // Un solo instante para la edad, el chequeo de plazo y `cancelled_at`.
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, student_profile_id, estured_fee_payment_id, booking_receipt_id, residences(name)")
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
    .select("id, user_id, birth_date")
    .eq("id", reservation.student_profile_id)
    .maybeSingle();
  const isOwner = Boolean(studentProfile?.user_id) && studentProfile?.user_id === params.actorUserId;

  // Quien NO es el estudiante beneficiario tiene que ser el pagador del fee, tener hoy el vínculo familiar activo con ese estudiante
  // (un familiar desvinculado o que pagó y se fue ya no puede revocar) Y el estudiante tiene que ser menor de edad a la fecha de la
  // revocación (DR6 (i), decisión del dueño 2026-10-24): si es mayor, solo ella/él puede revocar.
  let familyFirstName: string | null = null;
  if (!isOwner) {
    if (feePayment.payer_user_id !== params.actorUserId) return { ok: false, error: "Esta reserva no te pertenece." };
    const { data: link } = await admin
      .from("family_links")
      .select("id, family_members!inner(user_id, first_name)")
      .eq("student_profile_id", reservation.student_profile_id)
      .eq("status", "active")
      .eq("family_members.user_id", params.actorUserId)
      .maybeSingle();
    if (!link) return { ok: false, error: "Esta reserva no te pertenece." };
    const member = link.family_members as unknown as { first_name: string } | { first_name: string }[] | null;
    familyFirstName = (Array.isArray(member) ? member[0]?.first_name : member?.first_name) ?? null;
    // Mismo helper que el resto del proyecto (sin `birth_date` se trata como menor).
    if (!isMinorByBirthDate(studentProfile?.birth_date as string | null | undefined, nowDate)) {
      return { ok: false, error: REVOCATION_ADULT_STUDENT_ONLY_ERROR };
    }
  }

  if (reservation.status !== "confirmed") {
    return { ok: false, error: "Esta reserva no está en un estado que permita revocar el fee." };
  }
  if (feePayment.status !== "paid") {
    return { ok: false, error: "El fee de esta reserva todavía no está pagado." };
  }
  if (!feePayment.paid_at) {
    return { ok: false, error: "No pudimos determinar la fecha de pago del fee." };
  }

  const daysSincePaid = daysBetween(feePayment.paid_at, nowDate);
  if (daysSincePaid >= REVOCATION_WINDOW_DAYS) {
    return { ok: false, error: "El plazo de 10 días corridos para revocar el fee ya venció." };
  }

  // Update condicional: solo gana quien todavía encuentra la reserva `confirmed` (un doble clic o dos pestañas no revocan dos veces).
  const { data: revokedRows, error: reservationError } = await admin
    .from("reservations")
    .update({
      status: "cancelled_by_student",
      cancellation_reason_code: "student_revocation_right",
      cancelled_at: now,
    })
    .eq("id", reservation.id)
    .eq("status", "confirmed")
    .select("id");
  if (reservationError) {
    console.error("[revocation] reservation update failed:", reservationError);
    return { ok: false, error: "No pudimos registrar la revocación. Intentá de nuevo." };
  }
  if (!revokedRows || revokedRows.length === 0) {
    return { ok: false, error: "Esta reserva ya no está en un estado que permita revocar el fee." };
  }

  if (reservation.booking_receipt_id) {
    const { error: receiptError } = await admin
      .from("booking_receipts")
      .update({ status: "voided", voided_at: now })
      .eq("id", reservation.booking_receipt_id);
    if (receiptError) console.error("[revocation] booking receipt void failed:", receiptError);
  }

  const audited = await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: isOwner ? "student" : "family_member",
    action: "estured_fee_revoked",
    entityType: "reservations",
    entityId: reservation.id,
    reasonText: params.reason ?? undefined,
    newValue: { estured_fee_payment_id: feePayment.id, days_since_paid: Math.floor(daysSincePaid) },
    source: "user",
  });
  if (!audited) {
    await alertAdminsOfAuditFailure(admin, { action: "estured_fee_revoked", entityType: "reservations", entityId: reservation.id });
  }

  const residenceName = (reservation.residences as unknown as { name: string } | null)?.name ?? null;

  // Si revocó un familiar, el estudiante se entera siempre (es su reserva).
  if (!isOwner && studentProfile?.user_id) {
    await createNotification(admin, {
      category: "payments_fee",
      userId: studentProfile.user_id as string,
      title: "Se revocó el fee de tu reserva",
      body: `${familyFirstName ?? "Tu familiar"} revocó el fee de tu reserva en ${residenceName ?? "la residencia"}. La reserva quedó cancelada y el equipo de EstuRed va a revisar el caso.`,
      relatedEntityType: "fee_revocations",
      relatedEntityId: reservation.id,
    });
  }

  // Caso de Soporte para la revisión del admin (best-effort: nunca rompe la revocación).
  await openFeeRevocationSupportCase(admin, {
    actorUserId: params.actorUserId,
    actorRole: isOwner ? "student" : "family_member",
    reservationId: reservation.id,
    residenceName,
    studentReason: params.reason,
  });

  return { ok: true };
}
