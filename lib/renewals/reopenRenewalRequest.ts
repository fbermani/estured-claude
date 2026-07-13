import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type ReopenRenewalRequestResult = { status: "ok" } | { status: "error"; message: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reabrir una solicitud de renovación cerrada por falta de respuesta de
 * la residencia (`closed_no_offer`) — intervención de admin, mismo
 * criterio que `reopenApplication.ts` (Ciclo 34septies). Da un plazo
 * fresco de 30 días (la misma regla de creación) en vez de seguir
 * corriendo desde el vencimiento original.
 */
export async function reopenRenewalRequest(
  admin: SupabaseClient,
  params: { renewalRequestId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<ReopenRenewalRequestResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo de la reapertura es obligatorio." };

  const { data: request } = await admin
    .from("renewal_requests")
    .select("id, status, student_profile_id, residences(name)")
    .eq("id", params.renewalRequestId)
    .maybeSingle();
  if (!request) return { status: "error", message: "Solicitud de renovación no encontrada." };
  if (request.status !== "closed_no_offer") {
    return { status: "error", message: "Solo se pueden reabrir solicitudes de renovación cerradas sin oferta." };
  }

  const newExpiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const { error: updateError } = await admin
    .from("renewal_requests")
    .update({ status: "notified_to_residence", expires_at: newExpiresAt })
    .eq("id", request.id)
    .eq("status", "closed_no_offer");
  if (updateError) {
    console.error("[renewals] reopenRenewalRequest update failed:", updateError);
    return { status: "error", message: "No pudimos reabrir la solicitud. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "renewal_request_reopened_by_admin",
    entityType: "renewal_requests",
    entityId: request.id,
    oldValue: { status: "closed_no_offer" },
    newValue: { status: "notified_to_residence", expires_at: newExpiresAt },
    reasonText: reason,
    source: "admin",
  });

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", request.student_profile_id)
    .maybeSingle();
  if (studentProfile) {
    const residenceName = (request.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    await createNotification(admin, {
      userId: studentProfile.user_id,
      title: "Tu solicitud de renovación fue reabierta",
      body: `El equipo de EstuRed reabrió tu solicitud de renovación a ${residenceName}. Motivo: ${reason}`,
      relatedEntityType: "renewal_requests",
      relatedEntityId: request.id,
    });
  }

  return { status: "ok" };
}
