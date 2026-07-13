import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Job `expire_renewal_offers` (Ciclo 34nonies). `acceptance_deadline_at`
 * (migración 0016, elegido por la residencia, mínimo 48h) hoy solo se
 * chequea "lazy" al momento de responder (`respondRenewalOffer.ts`) — si
 * el estudiante nunca abre la pantalla, la oferta queda `sent` para
 * siempre y la reserva no se entera de que la renovación cayó. Este job
 * la cierra de verdad para que el estado sea consistente sin depender de
 * que alguien la mire.
 */
export async function expireRenewalOffers(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const now = new Date().toISOString();

  const { data: stale, error } = await admin
    .from("renewal_offers")
    .update({ status: "expired" })
    .in("status", ["sent", "viewed"])
    .lt("acceptance_deadline_at", now)
    .select("id, student_profile_id, residences(name)");
  if (error) {
    console.error("[jobs] expireRenewalOffers failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const row of stale ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "renewal_offer_expired",
      entityType: "renewal_offers",
      entityId: row.id,
      source: "system",
    });

    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("user_id")
      .eq("id", row.student_profile_id)
      .maybeSingle();
    if (studentProfile) {
      const residenceName = (row.residences as unknown as { name: string } | null)?.name ?? "la residencia";
      await createNotification(admin, {
        userId: studentProfile.user_id,
        title: "Venció una oferta de renovación",
        body: `No respondiste a tiempo la oferta de renovación de ${residenceName}.`,
        relatedEntityType: "renewal_offers",
        relatedEntityId: row.id,
      });
    }
    expiredCount += 1;
  }

  return { expiredCount };
}
