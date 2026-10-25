import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

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

    // DR12/D8 (2026-10-25): sin pantallas de plan y con todo habilitado, NO se avisa a la residencia
    // («Tu acceso a Gestión Operativa venció…»). Se retoma cuando haya precio.
    expiredCount += 1;
  }

  return { expiredCount };
}
