import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Job de vencimiento de verificación anual (docs/03 §"verificación
 * anual", docs/06 §onboarding, docs/19 §"debe renovarse anualmente").
 * `residence_verifications.expires_at` se setea a +365 días al aprobar
 * una verificación (`app/admin/verifications/actions.ts`) pero hasta
 * ahora nada lo chequeaba — una residencia con verificación vencida
 * seguía `verified_active` y publicada para siempre. `residences.status`
 * y `residence_verifications.status` ya tenían el valor `verification_expired`/
 * `expired` reservado en el enum desde la Fase 1, sin ningún código que
 * lo asignara.
 *
 * Solo cambia el estado — no dispara una re-verificación automática
 * (docs/09 §"disparar re-verificación" es una acción manual de admin,
 * fuera de alcance de este job). Al pasar a `verification_expired`, el
 * filtro existente de `lib/residences/catalog.ts` (`status = verified_active`)
 * ya la excluye de `/search` sin necesitar ningún cambio ahí.
 */
export async function expireResidenceVerifications(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const now = new Date().toISOString();

  const { data: staleVerifications, error } = await admin
    .from("residence_verifications")
    .select("id, residence_id, residences!inner(id, name, status)")
    .eq("status", "approved")
    .eq("residences.status", "verified_active")
    .lt("expires_at", now);
  if (error) {
    console.error("[jobs] expireResidenceVerifications query failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const v of staleVerifications ?? []) {
    const residence = v.residences as unknown as { id: string; name: string };

    const { error: verificationUpdateError } = await admin
      .from("residence_verifications")
      .update({ status: "expired" })
      .eq("id", v.id);
    if (verificationUpdateError) {
      console.error("[jobs] expireResidenceVerifications verification update failed:", verificationUpdateError);
      continue;
    }

    const { error: residenceUpdateError } = await admin
      .from("residences")
      .update({ status: "verification_expired" })
      .eq("id", residence.id);
    if (residenceUpdateError) {
      console.error("[jobs] expireResidenceVerifications residence update failed:", residenceUpdateError);
      continue;
    }

    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "residence_verification_expired",
      entityType: "residences",
      entityId: residence.id,
      source: "system",
    });

    const { data: residenceUsers } = await admin
      .from("residence_users")
      .select("user_id")
      .eq("residence_id", residence.id)
      .eq("is_active", true);
    for (const ru of residenceUsers ?? []) {
      await createNotification(admin, {
        userId: ru.user_id,
        title: "La verificación anual de tu residencia venció",
        body: `${residence.name} dejó de estar publicada porque su verificación anual venció. Contactá a EstuRed para coordinar la re-verificación.`,
        relatedEntityType: "residences",
        relatedEntityId: residence.id,
      });
    }
    expiredCount += 1;
  }

  return { expiredCount };
}
