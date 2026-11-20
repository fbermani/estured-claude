import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type RemoveFromWaitlistByAdminResult = { status: "ok" } | { status: "error"; message: string };

const ACTIVE_STATUSES = ["active", "availability_notification_sent", "retention_check_sent"];

/**
 * `removed_by_admin` ya existe en `waitlist_status` (docs/06 §10.2) y ya
 * tenía copy en `/admin/waitlists` y `/students/waitlist` — pero nada lo
 * seteaba nunca, mismo patrón que otros estados "de admin" encontrados
 * antes (renewals, applications). Mismo criterio que
 * `removeFromWaitlistByResidence.ts`, pero con motivo obligatorio
 * (consistente con el resto de las acciones de admin de este proyecto)
 * y notificación al estudiante.
 */
export async function removeFromWaitlistByAdmin(
  admin: SupabaseClient,
  params: { waitlistEntryId: string; actorUserId: string; actorRole: string; reason: string },
): Promise<RemoveFromWaitlistByAdminResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { status: "error", message: "El motivo es obligatorio." };

  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, status, student_profile_id, residences(name)")
    .eq("id", params.waitlistEntryId)
    .maybeSingle();
  if (!entry) return { status: "error", message: "No encontramos esa entrada de lista de espera." };
  if (!ACTIVE_STATUSES.includes(entry.status)) {
    return { status: "error", message: "Esta entrada ya no está activa." };
  }

  const { error } = await admin
    .from("waitlist_entries")
    .update({
      status: "removed_by_admin",
      removed_at: new Date().toISOString(),
      removed_by: params.actorUserId,
      removed_reason: reason,
    })
    .eq("id", entry.id);
  if (error) {
    console.error("[waitlist] removeFromWaitlistByAdmin update failed:", error);
    return { status: "error", message: "No pudimos sacar al estudiante de la lista. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "waitlist_entry_removed_by_admin",
    entityType: "waitlist_entries",
    entityId: entry.id,
    reasonText: reason,
    source: "admin",
  });

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", entry.student_profile_id)
    .maybeSingle();
  if (studentProfile) {
    const residenceName = (entry.residences as unknown as { name: string } | null)?.name ?? "la residencia";
    await createNotification(admin, {
      category: "requests_reservations",
      userId: studentProfile.user_id,
      title: "EstuRed te sacó de una lista de espera",
      body: `El equipo de EstuRed te sacó de la lista de espera de ${residenceName}. Motivo: ${reason}`,
      relatedEntityType: "waitlist_entries",
      relatedEntityId: entry.id,
    });
  }

  return { status: "ok" };
}
