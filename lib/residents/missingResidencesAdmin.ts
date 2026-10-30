import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { groupMissingResidences, type MissingResidenceGroup, type MissingResidenceRow } from "@/lib/residents/linkRequestRules";

/** «Residencias pedidas» (DR21): lo que el admin ve y marca. El contacto con la residencia es siempre manual, fuera de la plataforma. */

export async function listMissingResidences(
  admin: SupabaseClient,
): Promise<{ ok: true; groups: MissingResidenceGroup[] } | { ok: false; missingSchema: boolean }> {
  const { data, error } = await admin
    .from("missing_residence_requests")
    .select("id, residence_name, contact, created_at, contacted_at")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) {
    const missingSchema = isMissingSchemaError(error) || error.code === "42703";
    if (!missingSchema) console.error("[residents] listMissingResidences failed:", error);
    return { ok: false, missingSchema };
  }
  return { ok: true, groups: groupMissingResidences((data ?? []) as MissingResidenceRow[]) };
}

/** Marca como contactados los pedidos indicados (todos los de un mismo nombre). Idempotente. */
export async function markMissingResidenceContacted(
  admin: SupabaseClient,
  params: { actorUserId: string; actorRole: string; ids: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = [...new Set(params.ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 200);
  if (ids.length === 0) return { ok: false, error: "No encontramos ese pedido." };
  const { data: updated, error } = await admin
    .from("missing_residence_requests")
    .update({ contacted_at: new Date().toISOString(), contacted_by: params.actorUserId })
    .in("id", ids)
    .is("contacted_at", null)
    .select("id");
  if (error) {
    console.error("[residents] markMissingResidenceContacted failed:", error);
    return { ok: false, error: "No pudimos marcarla. Intentá de nuevo." };
  }
  const changed = ((updated ?? []) as { id: string }[]).map((r) => r.id);
  if (changed.length === 0) return { ok: true };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "missing_residence_contacted",
    entityType: "missing_residence_requests",
    entityId: changed[0],
    newValue: { requests: changed.length },
    source: "admin",
  });
  return { ok: true };
}
