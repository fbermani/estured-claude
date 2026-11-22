import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyFamilyReservationMilestone } from "@/lib/family/familyMilestones";
import { reactivatePausedApplications } from "@/lib/applications/reactivatePausedApplications";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";

/**
 * DR64 (d): `pending_manual_payment` NO vence. Un fee en ese estado ya fue informado dentro del plazo («Ya pagué» exige plazo vigente);
 * vencerlo haría perder la reserva a quien pagó por una demora de EstuRed. Se excluye por ESTADO (no por `student_reported_paid_at`)
 * para cubrir también las filas anteriores a la migración 0105. Vale para reservas y renovaciones (misma tabla).
 */
const PENDING_FEE_STATUSES = ["pending_payment_method", "pending_auto_charge", "processing"];

/**
 * Job `expire_estured_fee_windows` (docs/07 §17.2, §31) — cada hora.
 * Fees sin pagar dentro de la ventana pasan a `expired` (terminal) y la
 * reserva asociada a `expired_fee_unpaid`. No cuenta "hasta 3 intentos"
 * (docs/07 §17.2) porque hoy no hay cobro automático real que reintente
 * — el modo manual (Ciclo 11) no genera intentos fallidos que contar,
 * así que cualquier fee pendiente que venza expira directamente. Sin
 * notificación real (pendiente, docs/00 §29).
 */
export async function expireEsturedFeeWindows(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const { data: staleFees, error } = await admin
    .from("estured_fee_payments")
    .update({ status: "expired" })
    .in("status", PENDING_FEE_STATUSES)
    .lt("expires_at", new Date().toISOString())
    // DR64 (e): con «No pude realizar el pago» abierto (sin responder) el plazo se frena hasta que el admin responda.
    .or("student_payment_issue_at.is.null,student_payment_issue_resolved_at.not.is.null")
    // DR64 (d): con «No recibí el pago» abierto el fee tampoco vence (ya está en pending_manual_payment, excluido arriba; defensa en profundidad).
    .is("admin_disputed_at", null)
    .select("id, reservation_id, payer_user_id");

  if (error) {
    console.error("[jobs] expireEsturedFeeWindows failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const fee of staleFees ?? []) {
    if (fee.reservation_id) {
      const { data: expiredReservation, error: reservationError } = await admin
        .from("reservations")
        .update({ status: "expired_fee_unpaid" })
        .eq("id", fee.reservation_id)
        .eq("status", "pending_estured_fee")
        .select("student_profile_id")
        .maybeSingle();
      if (reservationError) {
        console.error("[jobs] expireEsturedFeeWindows reservation update failed:", reservationError);
      }
      // docs/04 §5.6: la reserva "no se confirmó" → las pausadas del estudiante se reactivan.
      if (expiredReservation?.student_profile_id) {
        await reactivatePausedApplications(admin, expiredReservation.student_profile_id);
      }
    }
    if (!fee.reservation_id) await expireRenewalOfferOfFee(admin, fee.id, (fee as { payer_user_id: string | null }).payer_user_id);
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "estured_fee_expired",
      entityType: "estured_fee_payments",
      entityId: fee.id,
      newValue: { reservation_id: fee.reservation_id },
      source: "system",
    });
    if (fee.reservation_id) await notifyFamilyReservationMilestone(admin, fee.reservation_id, "fee_expired");
    expiredCount += 1;
  }

  return { expiredCount };
}

/**
 * Decisión del dueño (2026-11-15, cierra el pendiente de SEG14-01): cuando vence el fee de una renovación, la oferta pasa a
 * `expired_no_student_payment` («Vencida»), se avisa al estudiante (y al pagador, si es otra persona) y al equipo de la residencia, y
 * la residencia tiene que enviar una renovación nueva. No se reabre: el job de reapertura de admin solo vale para ofertas `expired`
 * (sin respuesta). Update condicional: solo cierra ofertas que seguían esperando ese fee. Nunca lanza.
 */
async function expireRenewalOfferOfFee(admin: SupabaseClient, feeId: string, payerUserId: string | null): Promise<void> {
  try {
    const { data: offer } = await admin
      .from("renewal_offers")
      .update({ status: "expired_no_student_payment" })
      .eq("estured_fee_payment_id", feeId)
      .in("status", ["estured_fee_pending", "estured_fee_processing"])
      .select("id, residence_id, student_profile_id, residences(name)")
      .maybeSingle();
    if (!offer) return;

    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "renewal_offer_expired_fee_unpaid",
      entityType: "renewal_offers",
      entityId: offer.id,
      newValue: { estured_fee_payment_id: feeId },
      source: "system",
    });

    const { data: studentProfile } = await admin.from("student_profiles").select("user_id").eq("id", offer.student_profile_id).maybeSingle();
    const residenceName = (offer.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    const recipients = [...new Set([studentProfile?.user_id, payerUserId].filter((id): id is string => !!id))];
    await Promise.all(
      recipients.map((userId) =>
        createNotification(admin, {
          category: "deadlines",
          userId,
          title: "Venció el pago de tu renovación",
          body: `El fee EstuRed de tu renovación en ${residenceName} no se pagó a tiempo. La residencia tiene que enviarte una oferta nueva si quiere renovar.`,
          relatedEntityType: "renewal_offers",
          relatedEntityId: offer.id,
        }),
      ),
    );
    await notifyResidenceTeam(admin, { residenceId: offer.residence_id as string, event: "renewal_fee_expired", entityId: offer.id });
  } catch (error) {
    console.error("[jobs] expireRenewalOfferOfFee failed:", error);
  }
}
