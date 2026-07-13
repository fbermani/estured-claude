import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type SetResidentVisibilityResult = { ok: true } | { ok: false; error: string };

/**
 * Docs/05 §15.2 — "El estudiante/residente controla su visibilidad."
 * Permite al estudiante ocultarse de la comunidad visible de ESA
 * residencia puntual (`hidden_by_user`) o volver a mostrarse (`active`)
 * — no toca `student_visibility_settings` (esa es la config global de
 * qué campos mostrar; esto es "aparezco o no aparezco" en esta estadía).
 */
export async function setResidentVisibility(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId: string; hidden: boolean },
): Promise<SetResidentVisibilityResult> {
  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile) return { ok: false, error: "No encontramos tu perfil de estudiante." };

  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, student_profile_id, status")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay || stay.student_profile_id !== studentProfile.id) {
    return { ok: false, error: "Esa estadía no te pertenece." };
  }
  if (!["active", "hidden_by_user", "visibility_limited"].includes(stay.status)) {
    return { ok: false, error: "Esa estadía no está activa." };
  }

  const { error } = await admin
    .from("resident_stays")
    .update({ status: params.hidden ? "hidden_by_user" : "active" })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] setResidentVisibility update failed:", error);
    return { ok: false, error: "No pudimos guardar el cambio. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: params.hidden ? "resident_stay_hidden" : "resident_stay_shown",
    entityType: "resident_stays",
    entityId: params.residentStayId,
  });

  return { ok: true };
}
