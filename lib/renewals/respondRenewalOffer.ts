import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createPendingRenewalResidencePayment } from "@/lib/renewals/createPendingRenewalResidencePayment";

export type RespondRenewalOfferResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/12 §13.2, docs/05 §14 (solo el estudiante acepta/rechaza — el
 * familiar puede pagar el fee más adelante, pero no responde en su
 * nombre). Fase 2: al aceptar, encadena a `residence_payment_pending` +
 * crea la fila `external_residence_payments` en la misma operación
 * (mismo patrón que `recordNegotiationResponse` con
 * `createPendingResidencePayment` para la reserva inicial).
 */
export async function respondRenewalOffer(
  admin: SupabaseClient,
  params: { renewalOfferId: string; response: "accepted" | "rejected"; actorUserId: string },
): Promise<RespondRenewalOfferResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, student_profile_id, residence_id, reservation_id, acceptance_deadline_at")
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No encontramos esa oferta." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile || studentProfile.id !== offer.student_profile_id) {
    return { ok: false, error: "Esta oferta no te pertenece." };
  }

  if (offer.status !== "sent" && offer.status !== "viewed") {
    return { ok: false, error: "Esta oferta no está pendiente de respuesta." };
  }
  if (new Date(offer.acceptance_deadline_at) < new Date()) {
    return { ok: false, error: "El plazo para responder esta oferta ya venció." };
  }

  const now = new Date().toISOString();
  const accepted = params.response === "accepted";
  // Docs/07 §15.5 (mismo criterio que `recordNegotiationResponse`): aceptar
  // es un estado de tránsito automático hacia el pago, no debe quedar la
  // oferta parada en `accepted_by_student`.
  const newStatus = accepted ? "residence_payment_pending" : "rejected_by_student";

  const { error } = await admin
    .from("renewal_offers")
    .update({ status: newStatus, accepted_at: accepted ? now : null })
    .eq("id", offer.id);
  if (error) {
    console.error("[renewals] respondRenewalOffer update failed:", error);
    return { ok: false, error: "No pudimos registrar tu respuesta. Intentá de nuevo." };
  }

  if (accepted) {
    await createPendingRenewalResidencePayment(admin, {
      renewalOfferId: offer.id,
      residenceId: offer.residence_id,
      studentProfileId: offer.student_profile_id,
      reservationId: offer.reservation_id,
    });
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: accepted ? "renewal_offer_accepted_by_student" : "renewal_offer_rejected_by_student",
    entityType: "renewal_offers",
    entityId: offer.id,
    source: "user",
  });

  return { ok: true };
}
