import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { normalizeOwnFaqItems, validateOwnFaqItems, type OwnFaqItem } from "@/lib/residences/ownFaq";

export type SaveOwnFaqResult = { ok: true; items: OwnFaqItem[] } | { ok: false; error: string };

/**
 * Guarda las preguntas propias de la residencia (pares pregunta/respuesta de texto libre, sección `faq` de `residence_profile_sections`)
 * desde la pantalla de preguntas. Reemplaza la lista completa.
 *
 * Mismo criterio que el guardado del perfil (`saveResidenceProfile`): permiso `profile.edit` y aplicación directa, sin pasar por la
 * revisión de ediciones del admin (la sección `faq` no es un campo crítico, docs/09 §8). Lo que suma acá: validación estricta (no recorta
 * ni descarta en silencio) y auditoría con el valor anterior y el nuevo.
 */
export async function saveOwnFaq(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; items: unknown },
): Promise<SaveOwnFaqResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "profile.edit");
  if (!access.ok) return { ok: false, error: access.error };

  const checked = validateOwnFaqItems(params.items);
  if (!checked.ok) return checked;

  const { data: previousSection, error: previousError } = await admin
    .from("residence_profile_sections")
    .select("content")
    .eq("residence_id", params.residenceId)
    .eq("section_type", "faq")
    .maybeSingle();
  if (previousError) {
    console.error("[own-faq] previous read failed:", previousError.code, previousError.message);
    return { ok: false, error: "No pudimos guardar tus preguntas propias. Intentá de nuevo." };
  }
  const previous = normalizeOwnFaqItems((previousSection?.content as { items?: unknown } | null)?.items);

  const { error } = await admin
    .from("residence_profile_sections")
    .upsert({ residence_id: params.residenceId, section_type: "faq", content: { items: checked.items } }, { onConflict: "residence_id,section_type" });
  if (error) {
    console.error("[own-faq] save failed:", error.code, error.message);
    return { ok: false, error: "No pudimos guardar tus preguntas propias. Intentá de nuevo." };
  }

  if (JSON.stringify(previous) !== JSON.stringify(checked.items)) {
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "residence_own_faq_updated",
      entityType: "residences",
      entityId: params.residenceId,
      oldValue: { items: previous },
      newValue: { items: checked.items },
    });
  }
  return { ok: true, items: checked.items };
}
