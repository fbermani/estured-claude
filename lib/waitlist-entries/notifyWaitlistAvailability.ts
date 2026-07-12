import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

export type NotifyWaitlistAvailabilityResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/06 §27.8 ("notificar disponibilidad") — la residencia marca que
 * avisó a un estudiante en espera de que hay lugar. Sin `NotificationProvider`
 * real todavía (docs/00 §29): esto registra la intención/auditoría, no
 * dispara un email/push real — mismo criterio que el resto de "avisos"
 * pendientes en el proyecto (jobs de vencimiento, etc.).
 */
export async function notifyWaitlistAvailability(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string },
): Promise<NotifyWaitlistAvailabilityResult> {
  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, residence_id, status")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry) return { ok: false, error: "No encontramos esa entrada de lista de espera." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, entry.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esa residencia." };
  if (entry.status !== "active") return { ok: false, error: "Esta entrada no está activa." };

  const { error } = await admin
    .from("waitlist_entries")
    .update({ status: "availability_notification_sent" })
    .eq("id", entry.id);
  if (error) {
    console.error("[waitlist] notifyWaitlistAvailability update failed:", error);
    return { ok: false, error: "No pudimos registrar el aviso. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "waitlist_availability_notified",
    entityType: "waitlist_entries",
    entityId: entry.id,
  });

  return { ok: true };
}
