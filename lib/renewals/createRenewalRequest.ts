import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";

export type CreateRenewalRequestResult = { ok: true; renewalRequestId: string } | { ok: false; error: string };

/**
 * Docs/12 §13.1, docs/05 §14 ("estudiante alojado" — el familiar puede
 * sugerir o consultar, pero no inicia la solicitud formal). Solicitud
 * informal, no vinculante — la residencia puede responder con una
 * oferta formal (`renewal_offers`) o no responder.
 *
 * Sin plazo mínimo de días antes del fin del período actual (supuesto
 * reversible, docs/13 §4 — ningún doc lo especifica). Se guarda con
 * status `created_by_student` (default del enum) — no se auto-avanza
 * a `notified_to_residence`, ya que no hay una notificación real que
 * disparar (mismo criterio que otras entidades del proyecto sin
 * NotificationProvider todavía).
 *
 * `expires_at` a 30 días (Ciclo 34nonies, confirmado por el dueño — a
 * diferencia de las 48h del resto del sistema, acá el plazo es más largo
 * porque es una solicitud informal sin urgencia de negociación).
 */
export async function createRenewalRequest(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    actorUserId: string;
    message: string | null;
    desiredDurationMonths: number | null;
  },
): Promise<CreateRenewalRequestResult> {
  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, student_profile_id, residence_id")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (!reservation) return { ok: false, error: "No encontramos esa reserva." };
  if (reservation.status !== "confirmed") {
    return { ok: false, error: "Solo se puede solicitar renovación de una reserva confirmada." };
  }

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile || studentProfile.id !== reservation.student_profile_id) {
    return { ok: false, error: "Esta reserva no te pertenece." };
  }

  const { data: existing } = await admin
    .from("renewal_requests")
    .select("id")
    .eq("reservation_id", reservation.id)
    .in("status", ["created_by_student", "notified_to_residence", "offer_received"])
    .maybeSingle();
  if (existing) return { ok: false, error: "Ya tenés una solicitud de renovación en curso para esta reserva." };

  const { data: request, error } = await admin
    .from("renewal_requests")
    .insert({
      reservation_id: reservation.id,
      student_profile_id: reservation.student_profile_id,
      residence_id: reservation.residence_id,
      message: params.message,
      desired_duration_months: params.desiredDurationMonths,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !request) {
    console.error("[renewals] createRenewalRequest insert failed:", error);
    return { ok: false, error: "No pudimos registrar tu solicitud. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "renewal_request_created",
    entityType: "renewal_requests",
    entityId: request.id,
    source: "user",
  });

  await notifyResidenceTeam(admin, {
    residenceId: reservation.residence_id,
    event: "new_renewal_request",
    entityId: request.id,
  });

  return { ok: true, renewalRequestId: request.id };
}
