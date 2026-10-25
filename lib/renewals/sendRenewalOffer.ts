import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { OFFERABLE_RENEWAL_REQUEST_STATUSES } from "@/lib/renewals/createRenewalOffer";

export type SendRenewalOfferResult = { ok: true } | { ok: false; error: string };

/** Docs/12 §13 — envía una oferta guardada como borrador (`draft` → `sent`). */
export async function sendRenewalOffer(
  admin: SupabaseClient,
  params: { renewalOfferId: string; actorUserId: string },
): Promise<SendRenewalOfferResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, residence_id, reservation_id, renewal_request_id")
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No encontramos esa oferta." };
  if (offer.status !== "draft") return { ok: false, error: "Solo se puede enviar una oferta en borrador." };

  const access = await assertResidencePermission(admin, params.actorUserId, offer.residence_id, "renewals.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  const { error } = await admin
    .from("renewal_offers")
    .update({ status: "sent", sent_by_user_id: params.actorUserId })
    .eq("id", offer.id)
    .eq("residence_id", offer.residence_id)
    .eq("status", "draft");
  if (error) {
    console.error("[renewals] sendRenewalOffer update failed:", error);
    return { ok: false, error: "No pudimos enviar la oferta. Intentá de nuevo." };
  }

  if (offer.renewal_request_id) {
    // Solo la solicitud de ESTA reserva y todavía abierta (la oferta pudo guardarse como borrador antes de que `createRenewalOffer` validara
    // el id): nunca se mueve la solicitud de otra reserva.
    await admin
      .from("renewal_requests")
      .update({ status: "offer_received" })
      .eq("id", offer.renewal_request_id)
      .eq("reservation_id", offer.reservation_id)
      .in("status", [...OFFERABLE_RENEWAL_REQUEST_STATUSES]);
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "renewal_offer_sent",
    entityType: "renewal_offers",
    entityId: offer.id,
    source: "user",
  });

  return { ok: true };
}
