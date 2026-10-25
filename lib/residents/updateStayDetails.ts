import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";

/**
 * Actualiza los datos operativos de una estadía desde el panel del
 * residente (referencia `estured_admin_modal_perfil_del_residente`):
 * "Salida exacta" (expected_end_date) y "Tarifa del residente"
 * (monthly_rate_usd — si es null, rige la tarifa del tipo). No toca el
 * estado ni la visibilidad: eso sigue en manos del estudiante.
 */
export async function updateStayDetails(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    residentStayId: string;
    expectedEndDate: string | null;
    monthlyRateUsd: number | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const actorRole = access.actorRole;

  if (params.monthlyRateUsd != null && params.monthlyRateUsd < 0)
    return { ok: false, error: "La tarifa no puede ser negativa." };

  const { data: stay, error } = await admin
    .from("resident_stays")
    .update({
      expected_end_date: params.expectedEndDate,
      monthly_rate_usd: params.monthlyRateUsd,
    })
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .eq("is_current", true)
    .select("id")
    .maybeSingle();
  if (error || !stay) return { ok: false, error: "No pudimos actualizar la estadía." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "resident_stay_details_updated",
    entityType: "resident_stays",
    entityId: params.residentStayId,
    newValue: { permission: access.permission,
      expected_end_date: params.expectedEndDate,
      monthly_rate_usd: params.monthlyRateUsd,
    },
  });
  return { ok: true };
}
