import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog, notifyAdmins } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import {
  REJECT_REASON_MAX,
  planCustomAmenities,
  type CustomAmenityDraft,
  type CustomAmenityRow,
} from "@/lib/residences/customAmenities";

const COLUMNS = "id, residence_id, kind, label, status, reject_reason, created_at";

/** Ítems «Otro» de una residencia (todos los estados). `schemaReady: false` si la migración 0058 no está aplicada; `ok: false` ante un error real. */
export async function listCustomAmenities(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ ok: true; items: CustomAmenityRow[]; schemaReady: boolean } | { ok: false }> {
  const { data, error } = await admin
    .from("residence_custom_amenities")
    .select(COLUMNS)
    .eq("residence_id", residenceId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingSchemaError(error)) return { ok: true, items: [], schemaReady: false };
    console.error("[custom-amenities] list failed:", error.code, error.message);
    return { ok: false };
  }
  return { ok: true, items: (data ?? []) as CustomAmenityRow[], schemaReady: true };
}

/** Solo los aprobados, para la ficha pública. Cualquier falla (incluida la 0058 sin aplicar) devuelve vacío: la ficha nunca se rompe por esto. */
export async function getApprovedCustomAmenities(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ services: string[]; areas: string[] }> {
  const { data, error } = await admin
    .from("residence_custom_amenities")
    .select("kind, label")
    .eq("residence_id", residenceId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[custom-amenities] approved read failed:", error.code, error.message);
    return { services: [], areas: [] };
  }
  const rows = (data ?? []) as { kind: string; label: string }[];
  return {
    services: rows.filter((r) => r.kind === "service").map((r) => r.label),
    areas: rows.filter((r) => r.kind === "area").map((r) => r.label),
  };
}

/**
 * Sincroniza los ítems «Otro» enviados por la residencia (el permiso `profile.edit` ya se validó afuera). Los nuevos entran `pending`;
 * los que cambiaron de texto se recrean pendientes; los que ya no están se borran. Avisa a los admins solo si hay ítems nuevos.
 * Con `validateOnly` no escribe nada (sirve para rechazar el guardado antes de tocar el perfil).
 */
export async function syncCustomAmenities(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    residenceName: string;
    actorUserId: string;
    actorRole: string;
    drafts: CustomAmenityDraft[];
    validateOnly?: boolean;
  },
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const current = await listCustomAmenities(admin, params.residenceId);
  if (!current.ok) return { ok: false, error: "No pudimos leer los ítems propios. Intentá de nuevo en unos minutos." };
  const planned = planCustomAmenities(current.items, params.drafts);
  if (!planned.ok) return planned;
  const { toCreate, toDeleteIds } = planned.plan;
  if (toCreate.length === 0 && toDeleteIds.length === 0) return { ok: true, created: 0 };
  if (!current.schemaReady) {
    return { ok: false, error: "Todavía no podemos guardar ítems propios. Probá de nuevo en unos días." };
  }
  if (params.validateOnly) return { ok: true, created: toCreate.length };

  if (toCreate.length > 0) {
    const { error } = await admin
      .from("residence_custom_amenities")
      .insert(toCreate.map((c) => ({ residence_id: params.residenceId, kind: c.kind, label: c.label, status: "pending", created_by: params.actorUserId })));
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Alguno de los ítems propios ya existe. Revisá que no estén repetidos." };
      console.error("[custom-amenities] insert failed:", error.code, error.message);
      return { ok: false, error: "No pudimos guardar los ítems propios. Intentá de nuevo." };
    }
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "residence_custom_amenities_proposed",
      entityType: "residences",
      entityId: params.residenceId,
      newValue: { items: toCreate },
    });
    await notifyAdmins(admin, {
      title: "Ítems «Otro» para revisar",
      body: `«${params.residenceName}» propuso ${toCreate.length === 1 ? "un ítem propio" : `${toCreate.length} ítems propios`} para su ficha. Revisalos en «Ítems «Otro» de fichas».`,
      entityType: "residences",
      entityId: params.residenceId,
    });
  }
  // Se borra al final: si el insert de arriba falla, no se pierde ningún ítem existente.
  if (toDeleteIds.length > 0) {
    const { error } = await admin.from("residence_custom_amenities").delete().eq("residence_id", params.residenceId).in("id", toDeleteIds);
    if (error) {
      console.error("[custom-amenities] delete failed:", error.code, error.message);
      return { ok: false, error: "No pudimos quitar algunos ítems propios." };
    }
  }
  return { ok: true, created: toCreate.length };
}

/** Aprobar o rechazar un ítem pendiente (solo admin; el llamador valida la sesión). Falla si ya no está pendiente. Audita y avisa a la residencia. */
export async function reviewCustomAmenity(
  admin: SupabaseClient,
  params: { id: string; decision: "approved" | "rejected"; reason?: string; actorUserId: string; actorRole: "admin" | "superadmin" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = (params.reason ?? "").replace(/\s+/g, " ").trim().slice(0, REJECT_REASON_MAX);
  if (params.decision === "rejected" && !reason) return { ok: false, error: "Escribí el motivo del rechazo: la residencia lo va a ver." };

  const { data: updated, error } = await admin
    .from("residence_custom_amenities")
    .update({
      status: params.decision,
      reviewed_by: params.actorUserId,
      reviewed_at: new Date().toISOString(),
      reject_reason: params.decision === "rejected" ? reason : null,
    })
    .eq("id", params.id)
    .eq("status", "pending")
    .select("id, residence_id, kind, label")
    .maybeSingle();
  if (error) {
    console.error("[custom-amenities] review failed:", error.code, error.message);
    return { ok: false, error: "No pudimos guardar la decisión. Intentá de nuevo." };
  }
  if (!updated) return { ok: false, error: "Este ítem ya fue revisado. Actualizá la pantalla." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.decision === "approved" ? "residence_custom_amenity_approved" : "residence_custom_amenity_rejected",
    entityType: "residence_custom_amenities",
    entityId: updated.id as string,
    oldValue: { status: "pending" },
    newValue: { status: params.decision, kind: updated.kind, label: updated.label },
    reasonText: params.decision === "rejected" ? reason : undefined,
    source: "admin",
  });
  await notifyResidenceTeam(admin, {
    residenceId: updated.residence_id as string,
    event: params.decision === "approved" ? "custom_amenity_approved" : "custom_amenity_rejected",
    entityId: updated.id as string,
  });
  return { ok: true };
}
