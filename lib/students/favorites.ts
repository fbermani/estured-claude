import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type ToggleFavoriteResult = { ok: true; favorited: boolean } | { ok: false; error: string };

/**
 * Favoritos (docs/02 §8.1, docs/08 §6.2) — lista aditiva compartida
 * entre estudiante y familiar vinculado, sin workflow de aprobación
 * (a diferencia de `family_application_proposals`). Toggle: si ya
 * existe una fila para este estudiante+residencia se borra sin
 * importar quién la agregó originalmente (es "favorito de la cuenta",
 * no de la persona que tocó el botón).
 */
export async function toggleFavorite(
  admin: SupabaseClient,
  params: {
    studentProfileId: string;
    residenceId: string;
    actorUserId: string;
    actorRole: "student" | "family_member";
  },
): Promise<ToggleFavoriteResult> {
  const { data: existing } = await admin
    .from("student_favorites")
    .select("id")
    .eq("student_profile_id", params.studentProfileId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("student_favorites").delete().eq("id", existing.id);
    if (error) {
      console.error("[favorites] delete failed:", error);
      return { ok: false, error: "No pudimos actualizar tus favoritos. Intentá de nuevo." };
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "favorite_removed",
      entityType: "student_favorites",
      entityId: existing.id,
      newValue: { residence_id: params.residenceId },
    });
    return { ok: true, favorited: false };
  }

  const { data: inserted, error } = await admin
    .from("student_favorites")
    .insert({
      student_profile_id: params.studentProfileId,
      residence_id: params.residenceId,
      added_by_role: params.actorRole,
      added_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[favorites] insert failed:", error);
    return { ok: false, error: "No pudimos guardar el favorito. Intentá de nuevo." };
  }
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "favorite_added",
    entityType: "student_favorites",
    entityId: inserted.id,
    newValue: { residence_id: params.residenceId },
  });
  return { ok: true, favorited: true };
}

export async function isFavorited(
  admin: SupabaseClient,
  studentProfileId: string,
  residenceId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("student_favorites")
    .select("id")
    .eq("student_profile_id", studentProfileId)
    .eq("residence_id", residenceId)
    .maybeSingle();
  return !!data;
}
