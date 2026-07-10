import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

/**
 * Job `expire_negotiation_proposals` (docs/07 §15.6, §31) — cada hora.
 * Propuestas de ajuste sin respuesta del estudiante dentro de 48h hacen
 * que la solicitud pase a `expired_offer_no_response`. La propuesta en
 * sí no tiene un valor "expired" en `student_response` (constraint solo
 * admite accepted/rejected_*) — el estado terminal de la solicitud ya
 * deja constancia de que venció. Sin notificación real (pendiente,
 * docs/00 §29).
 */
export async function expireNegotiationProposals(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const { data: stale, error } = await admin
    .from("application_negotiation_proposals")
    .select("id, application_request_id")
    .is("student_response", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[jobs] expireNegotiationProposals lookup failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const proposal of stale ?? []) {
    const { data: updated, error: updateError } = await admin
      .from("application_requests")
      .update({ status: "expired_offer_no_response" })
      .eq("id", proposal.application_request_id)
      .eq("status", "offer_pending_student_acceptance")
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error("[jobs] expireNegotiationProposals update failed:", updateError);
      continue;
    }
    if (!updated) continue; // ya no estaba en el estado esperado (resuelta por otra vía mientras corría el job).

    await admin.from("application_status_events").insert({
      application_request_id: proposal.application_request_id,
      from_status: "offer_pending_student_acceptance",
      to_status: "expired_offer_no_response",
      changed_by_role: "system",
      reason_text: "Propuesta de ajuste vencida sin respuesta del estudiante (48h).",
    });
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "negotiation_proposal_expired",
      entityType: "application_requests",
      entityId: proposal.application_request_id,
      source: "system",
    });
    expiredCount += 1;
  }

  return { expiredCount };
}
