import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MODEL_VERSION } from "@/lib/regulations/modelTemplate";
import { hashRegulationText, validateRegulationText } from "@/lib/regulations/text";

export type PublishRegulationResult = { ok: true; versionNumber: number } | { ok: false; error: string };

export const MIGRATION_PENDING_MESSAGE =
  "Todavía no se pueden publicar reglamentos en este entorno. Estamos terminando de prepararlo; probá de nuevo más adelante.";

/**
 * Publica una versión nueva del reglamento de la residencia (DR14, docs/05 §16bis, docs/06 §8.7).
 * Permiso `profile.edit` (dueño siempre; staff si el dueño se lo encendió). SIN revisión del admin (decisión del dueño, 2026-10-25):
 * rige apenas se publica, solo para solicitudes nuevas. La versión vigente pasa a `superseded` y se conserva; las aceptaciones ya
 * guardadas siguen apuntando a la versión que se aceptó. La escritura es ATÓMICA (función SQL `publish_residence_regulation`, solo service role).
 */
export async function publishRegulationVersion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; text: unknown; source: unknown },
): Promise<PublishRegulationResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "profile.edit");
  if (!access.ok) return { ok: false, error: access.error };

  const checked = validateRegulationText(params.text);
  if (!checked.ok) return checked;
  if (params.source !== "own" && params.source !== "model") return { ok: false, error: "Elegí si partís del modelo o si es un reglamento propio." };
  const source = params.source;
  const hash = hashRegulationText(checked.value);

  // Publicación atómica en la base (función SQL de la 0053): bloquea la residencia, reemplaza la vigente y crea la nueva en una sola transacción.
  // Así un fallo a mitad de camino no deja dos vigentes ni ninguna, y no hay carrera con la versión del modelo (`ensure_model_regulation_version`).
  const { data, error } = await admin.rpc("publish_residence_regulation", {
    p_residence_id: params.residenceId,
    p_actor_user_id: params.actorUserId,
    p_source: source,
    p_model_version: source === "model" ? MODEL_VERSION : null,
    p_content: { text: checked.value },
    p_hash: hash,
  });
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, error: MIGRATION_PENDING_MESSAGE };
    if (/no_changes/.test(error.message ?? "")) {
      return { ok: false, error: "No hay cambios respecto del reglamento vigente. Editá el texto antes de publicar." };
    }
    console.error("[regulations] publish failed:", error.code, error.message);
    return { ok: false, error: "No pudimos publicar el reglamento. Intentá de nuevo: no se cambió nada." };
  }
  const result = data as { id?: string; version_number?: number; previous_version_number?: number | null; previous_hash?: string | null } | null;
  if (!result?.id || typeof result.version_number !== "number") {
    console.error("[regulations] publish returned an unexpected payload");
    return { ok: false, error: "No pudimos confirmar la publicación. Revisá el historial antes de volver a intentar." };
  }
  const nextNumber = result.version_number;
  const draftId = result.id;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_regulation_published",
    entityType: "residence_regulation_versions",
    entityId: draftId,
    oldValue: result.previous_version_number ? { version_number: result.previous_version_number, content_hash: result.previous_hash ?? null } : null,
    newValue: { residence_id: params.residenceId, version_number: nextNumber, source, content_hash: hash },
  });

  return { ok: true, versionNumber: nextNumber };
}
