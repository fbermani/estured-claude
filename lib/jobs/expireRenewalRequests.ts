import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Job `expire_renewal_requests` (Ciclo 34nonies, regla confirmada por el
 * dueño: 30 días sin respuesta de la residencia). `renewal_requests` no
 * tenía columna de vencimiento hasta la migración 0022 — el estado
 * `closed_no_offer` existía en el enum desde el Ciclo 30 pero nada lo
 * alcanzaba nunca. Mismo criterio que el resto de los jobs de
 * vencimiento: nunca lanza por fila (un fallo de notificación no debe
 * frenar el resto del batch).
 */
export async function expireRenewalRequests(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const now = new Date().toISOString();

  const { data: stale, error } = await admin
    .from("renewal_requests")
    .update({ status: "closed_no_offer" })
    .in("status", ["created_by_student", "notified_to_residence"])
    .lt("expires_at", now)
    .select("id, student_profile_id, residences(name)");
  if (error) {
    console.error("[jobs] expireRenewalRequests failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const row of stale ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "renewal_request_closed_no_offer",
      entityType: "renewal_requests",
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
        category: "deadlines",
        userId: studentProfile.user_id,
        title: "Tu solicitud de renovación venció",
        body: `${residenceName} no respondió tu solicitud de renovación dentro de los 30 días. Podés volver a pedirla cuando quieras.`,
        relatedEntityType: "renewal_requests",
        relatedEntityId: row.id,
      });
    }
    expiredCount += 1;
  }

  return { expiredCount };
}
