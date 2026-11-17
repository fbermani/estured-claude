import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { loadShareData } from "@/lib/share/shareData";
import { DEFAULT_SHARE_TEMPLATE, resolveShareMessage, validateShareTemplate } from "@/lib/share/resolveShareMessage";

export const SHARE_MIGRATION_PENDING_MESSAGE =
  "Guardar tu propio mensaje todavía no está disponible en este entorno. Mientras tanto podés compartir el mensaje original.";

export type ShareTemplateLoad = {
  /** Plantilla vigente: la guardada por la residencia o, si no hay, la original. */
  template: string;
  /** `true` si la residencia guardó su propia versión. */
  isCustom: boolean;
  /** `false` si la tabla todavía no existe (0095 sin aplicar): se puede compartir pero no guardar. */
  schemaReady: boolean;
};

/** Plantilla vigente de la residencia. Ante cualquier falla de lectura devuelve la original (compartir siempre funciona). */
export async function loadShareTemplate(admin: SupabaseClient, residenceId: string): Promise<ShareTemplateLoad> {
  const { data, error } = await admin.from("residence_share_messages").select("template").eq("residence_id", residenceId).maybeSingle();
  if (error) {
    const missing = isMissingSchemaError(error);
    if (!missing) console.error("[share] lectura fallida:", error.code, error.message);
    return { template: DEFAULT_SHARE_TEMPLATE, isCustom: false, schemaReady: !missing };
  }
  const saved = typeof data?.template === "string" ? data.template : null;
  return saved ? { template: saved, isCustom: true, schemaReady: true } : { template: DEFAULT_SHARE_TEMPLATE, isCustom: false, schemaReady: true };
}

export type SaveShareResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Guarda el mensaje propio de la residencia (permiso `profile.edit`: el dueño siempre; el staff solo si el dueño se lo dio). Valida en el
 * servidor (máx. 1.000 caracteres, con `{LINK}`, solo placeholders conocidos) y que el texto YA RESUELTO con los datos reales también entre.
 * Si el texto coincide con el original, se borra la fila (vuelve a «usando el original»). Auditado.
 */
export async function saveShareTemplate(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; template: unknown },
): Promise<SaveShareResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "profile.edit");
  if (!access.ok) return { ok: false, error: access.error };

  const shape = validateShareTemplate(params.template);
  if (!shape.ok) return shape;
  const data = await loadShareData(admin, params.residenceId);
  if (!data) return { ok: false, error: "No pudimos leer los datos de tu residencia. Intentá de nuevo en unos minutos." };
  const checked = validateShareTemplate(shape.template, { resolvedLength: resolveShareMessage(shape.template, data.values).length });
  if (!checked.ok) return checked;

  const { data: previous, error: previousError } = await admin
    .from("residence_share_messages")
    .select("template")
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (previousError) {
    if (isMissingSchemaError(previousError)) return { ok: false, error: SHARE_MIGRATION_PENDING_MESSAGE };
    console.error("[share] lectura previa fallida:", previousError.code, previousError.message);
    return { ok: false, error: "No pudimos guardar tu mensaje. Intentá de nuevo." };
  }

  if (checked.template === DEFAULT_SHARE_TEMPLATE) {
    // Igual al original: no se guarda una copia (así cualquier mejora futura del original le llega a la residencia).
    const { error } = await admin.from("residence_share_messages").delete().eq("residence_id", params.residenceId);
    if (error) {
      if (isMissingSchemaError(error)) return { ok: false, error: SHARE_MIGRATION_PENDING_MESSAGE };
      console.error("[share] borrado fallido:", error.code, error.message);
      return { ok: false, error: "No pudimos guardar tu mensaje. Intentá de nuevo." };
    }
  } else {
    const { error } = await admin
      .from("residence_share_messages")
      .upsert({ residence_id: params.residenceId, template: checked.template, updated_by_user_id: params.actorUserId }, { onConflict: "residence_id" });
    if (error) {
      if (isMissingSchemaError(error)) return { ok: false, error: SHARE_MIGRATION_PENDING_MESSAGE };
      console.error("[share] guardado fallido:", error.code, error.message);
      return { ok: false, error: "No pudimos guardar tu mensaje. Intentá de nuevo." };
    }
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_share_message_saved",
    entityType: "residences",
    entityId: params.residenceId,
    oldValue: previous ? { custom: true } : { custom: false },
    newValue: { custom: checked.template !== DEFAULT_SHARE_TEMPLATE, length: checked.template.length },
  });
  return { ok: true, message: checked.template };
}

/** Vuelve al mensaje original (borra la versión guardada). Mismo permiso (`profile.edit`) y auditoría. Es idempotente. */
export async function resetShareTemplate(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string },
): Promise<SaveShareResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "profile.edit");
  if (!access.ok) return { ok: false, error: access.error };

  const { error } = await admin.from("residence_share_messages").delete().eq("residence_id", params.residenceId);
  if (error) {
    // Sin la tabla ya se usa el original: no hay nada que restablecer.
    if (isMissingSchemaError(error)) return { ok: true, message: DEFAULT_SHARE_TEMPLATE };
    console.error("[share] restablecer fallido:", error.code, error.message);
    return { ok: false, error: "No pudimos restablecer el mensaje. Intentá de nuevo." };
  }
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_share_message_reset",
    entityType: "residences",
    entityId: params.residenceId,
  });
  return { ok: true, message: DEFAULT_SHARE_TEMPLATE };
}
