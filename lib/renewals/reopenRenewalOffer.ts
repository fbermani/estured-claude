import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type ReopenRenewalOfferResult = { status: "ok" } | { status: "error"; message: string };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Reabrir una oferta de renovación vencida sin respuesta (`expired`) —
 * intervención de admin, mismo criterio que `reopenApplication.ts`
 * (Ciclo 34septies). A diferencia de la solicitud (30 días, regla fija),
 * el plazo original de la oferta lo elige la residencia libremente
 * (`acceptance_deadline_at`, mínimo 48h) — no hay un valor "de origen"
 * al que volver. Se usa 7 días como reextensión por defecto: supuesto
 * reversible (docs/13 §4), no especificado en ningún doc porque es un
 * detalle de esta herramienta de admin, no una regla de producto.
 */
export async function reopenRenewalOffer(
  admin: SupabaseClient,
  params: { renewalOfferId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<ReopenRenewalOfferResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo de la reapertura es obligatorio." };

  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, student_profile_id, residences(name)")
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { status: "error", message: "Oferta de renovación no encontrada." };
  if (offer.status !== "expired") {
    return { status: "error", message: "Solo se pueden reabrir ofertas de renovación vencidas." };
  }

  const newDeadline = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
  const { error: updateError } = await admin
    .from("renewal_offers")
    .update({ status: "sent", acceptance_deadline_at: newDeadline })
    .eq("id", offer.id)
    .eq("status", "expired");
  if (updateError) {
    console.error("[renewals] reopenRenewalOffer update failed:", updateError);
    return { status: "error", message: "No pudimos reabrir la oferta. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "renewal_offer_reopened_by_admin",
    entityType: "renewal_offers",
    entityId: offer.id,
    oldValue: { status: "expired" },
    newValue: { status: "sent", acceptance_deadline_at: newDeadline },
    reasonText: reason,
    source: "admin",
  });

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", offer.student_profile_id)
    .maybeSingle();
  if (studentProfile) {
    const residenceName = (offer.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    await createNotification(admin, {
      category: "requests_reservations",
      userId: studentProfile.user_id,
      title: "Te dieron otra chance para responder una oferta de renovación",
      body: `El equipo de EstuRed reabrió tu oferta de renovación de ${residenceName} — tenés 7 días más para responder. Motivo: ${reason}`,
      relatedEntityType: "renewal_offers",
      relatedEntityId: offer.id,
    });
  }

  return { status: "ok" };
}
