import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

export type EndResidentStayResult = { ok: true } | { ok: false; error: string };

/** Docs/06 §15.1 — la residencia marca que un residente ya no está (mudanza, fin de estadía). */
export async function endResidentStay(
  admin: SupabaseClient,
  params: { actorUserId: string; residentStayId: string; endDate: string | null },
): Promise<EndResidentStayResult> {
  const { data: stay } = await admin
    .from("resident_stays")
    .select("id, residence_id, is_current")
    .eq("id", params.residentStayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "No encontramos esa estadía." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, stay.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };
  if (!stay.is_current) return { ok: false, error: "Esa estadía ya está cerrada." };

  const { error } = await admin
    .from("resident_stays")
    .update({ status: "inactive", is_current: false, end_date: params.endDate ?? new Date().toISOString().slice(0, 10) })
    .eq("id", params.residentStayId);
  if (error) {
    console.error("[residents] endResidentStay update failed:", error);
    return { ok: false, error: "No pudimos cerrar la estadía. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "resident_stay_ended",
    entityType: "resident_stays",
    entityId: params.residentStayId,
  });

  return { ok: true };
}
