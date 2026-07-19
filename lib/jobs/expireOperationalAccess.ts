import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

/**
 * Job de expiración del acceso freemium "de prueba para pioneras"
 * (docs/12 §15.3, migración 0030): revoca automáticamente cuando pasa
 * `pioneer_free_access_until`. Un acceso otorgado sin fecha límite
 * (`null`) nunca vence por este job — queda indefinido hasta que un
 * admin lo revoque a mano.
 */
export async function expireOperationalAccess(admin: SupabaseClient): Promise<{ expiredCount: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: stale, error } = await admin
    .from("residences")
    .update({ has_operational_management_access: false })
    .eq("has_operational_management_access", true)
    .not("pioneer_free_access_until", "is", null)
    .lt("pioneer_free_access_until", today)
    .select("id, name");
  if (error) {
    console.error("[jobs] expireOperationalAccess failed:", error);
    return { expiredCount: 0 };
  }

  let expiredCount = 0;
  for (const residence of stale ?? []) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "operational_access_expired",
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
        title: "Tu acceso a Gestión Operativa venció",
        body: `El período de prueba de Gestión Operativa de ${residence.name} llegó a su fecha límite. Escribinos si querés renovarlo.`,
        relatedEntityType: "residences",
        relatedEntityId: residence.id,
      });
    }
    expiredCount += 1;
  }

  return { expiredCount };
}
