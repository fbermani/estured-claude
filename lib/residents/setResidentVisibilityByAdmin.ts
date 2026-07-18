import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type SetResidentVisibilityByAdminResult = { ok: true } | { ok: false; error: string };

/**
 * Ocultar/restaurar el perfil de un residente por moderación admin
 * (docs/09 §21.3) — a diferencia de `setResidentVisibility.ts` (el
 * propio estudiante decide mostrarse u ocultarse), acá no hay chequeo
 * de dueño: el admin actúa sobre cualquier residencia. Requiere motivo
 * cuando oculta (no cuando restaura — restaurar visibilidad no necesita
 * justificarse, ocultar el perfil de alguien sí).
 */
export async function setResidentVisibilityByAdmin(
  admin: SupabaseClient,
  params: { adminUserId: string; adminRole: string; residentStayId: string; hidden: boolean; reason: string },
): Promise<SetResidentVisibilityByAdminResult> {
  const reason = params.reason.trim();
  if (params.hidden && reason.length < 5) return { ok: false, error: "El motivo para ocultar el perfil es obligatorio." };

  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, status, student_profile_id, student_profiles(user_id, first_name)")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "No encontramos esa estadía." };
  if (!["active", "hidden_by_user", "visibility_limited"].includes(stay.status)) {
    return { ok: false, error: "Esa estadía no está activa." };
  }

  const { error } = await admin
    .from("resident_stays")
    .update({ status: params.hidden ? "visibility_limited" : "active" })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] setResidentVisibilityByAdmin update failed:", error);
    return { ok: false, error: "No pudimos guardar el cambio. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.adminUserId,
    actorRole: params.adminRole,
    action: params.hidden ? "resident_visibility_limited_by_admin" : "resident_visibility_restored_by_admin",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    reasonText: reason || undefined,
    source: "admin",
  });

  const studentProfile = stay.student_profiles as unknown as { user_id: string; first_name: string } | null;
  if (studentProfile) {
    await createNotification(admin, {
      userId: studentProfile.user_id,
      title: params.hidden ? "Tu perfil quedó con visibilidad limitada" : "Tu perfil volvió a ser visible",
      body: params.hidden
        ? `El equipo de EstuRed limitó la visibilidad de tu perfil en la comunidad. Motivo: ${reason}`
        : "El equipo de EstuRed restauró la visibilidad completa de tu perfil en la comunidad.",
      relatedEntityType: "resident_stays",
      relatedEntityId: params.residentStayId,
    });
  }

  return { ok: true };
}
