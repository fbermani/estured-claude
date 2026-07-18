import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type MarkResidentInactiveByAdminResult = { ok: true } | { ok: false; error: string };

/**
 * Marcar residente inactivo por moderación admin (docs/09 §21.3) —
 * distinto de `endResidentStay.ts` (la residencia cierra una estadía
 * por mudanza/fin normal, sin motivo obligatorio). Acá el motivo es
 * obligatorio porque es una intervención de moderación, no un cierre
 * de rutina.
 */
export async function markResidentInactiveByAdmin(
  admin: SupabaseClient,
  params: { adminUserId: string; adminRole: string; residentStayId: string; reason: string },
): Promise<MarkResidentInactiveByAdminResult> {
  const reason = params.reason.trim();
  if (reason.length < 5) return { ok: false, error: "El motivo es obligatorio." };

  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, is_current, student_profiles(user_id)")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "No encontramos esa estadía." };
  if (!stay.is_current) return { ok: false, error: "Esa estadía ya está cerrada." };

  const { error } = await admin
    .from("resident_stays")
    .update({ status: "inactive", is_current: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] markResidentInactiveByAdmin update failed:", error);
    return { ok: false, error: "No pudimos guardar el cambio. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.adminUserId,
    actorRole: params.adminRole,
    action: "resident_marked_inactive_by_admin",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    reasonText: reason,
    source: "admin",
  });

  const studentProfile = stay.student_profiles as unknown as { user_id: string } | null;
  if (studentProfile) {
    await createNotification(admin, {
      userId: studentProfile.user_id,
      title: "Tu estadía fue marcada como inactiva",
      body: `El equipo de EstuRed marcó tu estadía como inactiva. Motivo: ${reason}`,
      relatedEntityType: "resident_stays",
      relatedEntityId: params.residentStayId,
    });
  }

  return { ok: true };
}
