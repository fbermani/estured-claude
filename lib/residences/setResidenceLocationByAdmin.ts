import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { parseCoordinates } from "@/lib/residences/residenceLocation";

export type SetResidenceLocationResult =
  | { status: "ok"; lat: number | null; lng: number | null }
  | { status: "error"; message: string };

const SAVE_ERROR_MESSAGE =
  "No pudimos guardar la ubicación. Probá de nuevo; si sigue fallando, revisá que la migración 0042 esté aplicada.";

/**
 * Carga (o quita) la coordenada de una residencia (migración 0042). Solo admin: quien llama debe haber
 * pasado por `getAdminSession`/`requireAdmin`. La ubicación es pública (decisión del dueño, 2026-10-23), así
 * que se guarda exacta (6 decimales). Auditado con el valor anterior y el nuevo.
 */
export async function setResidenceLocationByAdmin(
  admin: SupabaseClient,
  params: { residenceId: string; actorUserId: string; actorRole: string; latitude: unknown; longitude: unknown },
): Promise<SetResidenceLocationResult> {
  const parsed = parseCoordinates(params.latitude, params.longitude);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const { data: residence, error: readError } = await admin
    .from("residences")
    .select("id, latitude, longitude")
    .eq("id", params.residenceId)
    .maybeSingle();
  if (readError) {
    console.error("[residences] setResidenceLocationByAdmin read failed:", readError);
    return { status: "error", message: SAVE_ERROR_MESSAGE };
  }
  if (!residence) return { status: "error", message: "Residencia no encontrada." };

  const { error } = await admin
    .from("residences")
    .update({ latitude: parsed.lat, longitude: parsed.lng })
    .eq("id", residence.id);
  if (error) {
    console.error("[residences] setResidenceLocationByAdmin update failed:", error);
    return { status: "error", message: SAVE_ERROR_MESSAGE };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_location_updated",
    entityType: "residences",
    entityId: residence.id,
    oldValue: { latitude: residence.latitude ?? null, longitude: residence.longitude ?? null },
    newValue: { latitude: parsed.lat, longitude: parsed.lng },
    source: "admin",
  });

  return { status: "ok", lat: parsed.lat, lng: parsed.lng };
}
