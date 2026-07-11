import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type RespondRenewalOfferResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/12 §13.2, docs/05 §14 (solo el estudiante acepta/rechaza — el
 * familiar puede pagar el fee más adelante, pero no responde en su
 * nombre). Fase 1 del módulo: se detiene en `accepted_by_student` /
 * `rejected_by_student` — el encadenamiento a `residence_payment_pending`
 * (mismo patrón que `recordNegotiationResponse`) queda para la fase 2,
 * cuando se construya el pago a residencia de la renovación.
 */
export async function respondRenewalOffer(
  admin: SupabaseClient,
  params: { renewalOfferId: string; response: "accepted" | "rejected"; actorUserId: string },
): Promise<RespondRenewalOfferResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, student_profile_id, acceptance_deadline_at")
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
  const newStatus = params.response === "accepted" ? "accepted_by_student" : "rejected_by_student";

  const { error } = await admin
    .from("renewal_offers")
    .update({ status: newStatus, accepted_at: params.response === "accepted" ? now : null })
    .eq("id", offer.id);
  if (error) {
    console.error("[renewals] respondRenewalOffer update failed:", error);
    return { ok: false, error: "No pudimos registrar tu respuesta. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: `renewal_offer_${newStatus}`,
    entityType: "renewal_offers",
    entityId: offer.id,
    source: "user",
  });

  return { ok: true };
}
