import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

/**
 * Job `expire_family_proposals` (docs/07 §9.4, §31) — cada hora.
 * Propuestas del familiar sin respuesta del estudiante dentro de 48h
 * pasan a `expired`. Sin notificación real (NotificationProvider
 * pendiente, docs/00 §29) — solo el cambio de estado y la auditoría.
 */
export async function expireFamilyProposals(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const { data: expired, error } = await admin
    .from("family_application_proposals")
    .update({ status: "expired" })
    .eq("status", "pending_student_approval")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[jobs] expireFamilyProposals failed:", error);
    return { expiredCount: 0 };
  }

  for (const row of expired ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "family_proposal_expired",
      entityType: "family_application_proposals",
      entityId: row.id,
      source: "system",
    });
  }

  return { expiredCount: expired?.length ?? 0 };
}
