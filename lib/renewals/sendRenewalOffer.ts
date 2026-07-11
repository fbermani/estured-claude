import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

export type SendRenewalOfferResult = { ok: true } | { ok: false; error: string };

/** Docs/12 §13 — envía una oferta guardada como borrador (`draft` → `sent`). */
export async function sendRenewalOffer(
  admin: SupabaseClient,
  params: { renewalOfferId: string; actorUserId: string },
): Promise<SendRenewalOfferResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, residence_id, renewal_request_id")
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No encontramos esa oferta." };
  if (offer.status !== "draft") return { ok: false, error: "Solo se puede enviar una oferta en borrador." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, offer.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  const { error } = await admin
    .from("renewal_offers")
    .update({ status: "sent", sent_by_user_id: params.actorUserId })
    .eq("id", offer.id);
  if (error) {
    console.error("[renewals] sendRenewalOffer update failed:", error);
    return { ok: false, error: "No pudimos enviar la oferta. Intentá de nuevo." };
  }

  if (offer.renewal_request_id) {
    await admin.from("renewal_requests").update({ status: "offer_received" }).eq("id", offer.renewal_request_id);
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "renewal_offer_sent",
    entityType: "renewal_offers",
    entityId: offer.id,
    source: "user",
  });

  return { ok: true };
}
