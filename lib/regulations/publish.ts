import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import type { ResidenceActorRole } from "@/lib/residences/permissions";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { MODEL_VERSION } from "@/lib/regulations/modelTemplate";
import { hashRegulationText, validateRegulationText } from "@/lib/regulations/text";
import { createHash } from "node:crypto";
import { extensionForMime, resolveDocumentType, toTypedBlob } from "@/lib/files/sniffFile";
import { MAX_REGULATION_PDF_BYTES, REGULATION_PDF_BUCKET, REGULATION_PDF_NOTICE } from "@/lib/regulations/pdfFile";
import { safeFilename } from "@/lib/files/safeFilename";

export type PublishRegulationResult = { ok: true; versionNumber: number } | { ok: false; error: string; unchanged?: true };

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
  return publishVersion(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    residenceId: params.residenceId,
    source,
    content: { text: checked.value },
    hash: hashRegulationText(checked.value),
  });
}

/**
 * Publica como versión un reglamento propio en PDF (DR62 a). Mismo permiso, mismas reglas y misma publicación atómica que el texto.
 * El hash es el SHA-256 de los bytes del archivo. Tope 5 MB; solo PDF (se comprueba la firma real, no el MIME declarado).
 * La ruta del archivo sale del hash: el mismo PDF siempre cae en la misma ruta. Si la publicación falla, el archivo queda sin versión (inofensivo, privado).
 */
export async function publishRegulationPdfVersion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; file: unknown },
): Promise<PublishRegulationResult> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "profile.edit");
  if (!access.ok) return { ok: false, error: access.error };

  const file = params.file;
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí el archivo PDF del reglamento." };
  if (file.size > MAX_REGULATION_PDF_BYTES) return { ok: false, error: "El PDF del reglamento no puede superar los 5 MB." };
  if ((await resolveDocumentType(file)) !== "application/pdf") return { ok: false, error: "El reglamento debe ser un archivo PDF." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `${params.residenceId}/reglamento-version-${hash.slice(0, 16)}.${extensionForMime("application/pdf")}`;
  const { error: uploadError } = await admin.storage
    .from(REGULATION_PDF_BUCKET)
    .upload(path, await toTypedBlob(file, "application/pdf"), { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    console.error("[regulations] pdf upload failed:", uploadError.message);
    return { ok: false, error: "No pudimos subir el PDF. Intentá de nuevo: no se cambió nada." };
  }

  const result = await publishVersion(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    residenceId: params.residenceId,
    source: "own",
    content: { text: REGULATION_PDF_NOTICE, pdf: { path, filename: safeFilename(file.name), size_bytes: file.size } },
    hash,
    cleanupPath: path,
  });
  return result;
}

async function publishVersion(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    actorRole: ResidenceActorRole;
    residenceId: string;
    source: "own" | "model";
    content: Record<string, unknown>;
    hash: string;
    /** Hay un archivo PDF detrás de esta versión (solo para la auditoría). */
    cleanupPath?: string;
  },
): Promise<PublishRegulationResult> {
  const { source, hash } = params;
  // Si la publicación falla, el archivo subido NO se borra: la ruta sale del hash y puede ser la misma de una versión anterior que ya se aceptó.
  const discardUpload = async () => {};

  // Publicación atómica en la base (función SQL de la 0053): bloquea la residencia, reemplaza la vigente y crea la nueva en una sola transacción.
  // Así un fallo a mitad de camino no deja dos vigentes ni ninguna, y no hay carrera con la versión del modelo (`ensure_model_regulation_version`).
  const { data, error } = await admin.rpc("publish_residence_regulation", {
    p_residence_id: params.residenceId,
    p_actor_user_id: params.actorUserId,
    p_source: source,
    p_model_version: source === "model" ? MODEL_VERSION : null,
    p_content: params.content,
    p_hash: hash,
  });
  if (error) {
    if (isMissingSchemaError(error)) {
      await discardUpload();
      return { ok: false, error: MIGRATION_PENDING_MESSAGE };
    }
    if (/no_changes/.test(error.message ?? "")) {
      // El PDF idéntico ya es el vigente y usa esta misma ruta (el nombre sale del hash): no se borra.
      return { ok: false, error: "No hay cambios respecto del reglamento vigente. Editá el texto o elegí otro archivo antes de publicar.", unchanged: true };
    }
    console.error("[regulations] publish failed:", error.code, error.message);
    await discardUpload();
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
    actorRole: params.actorRole,
    action: "residence_regulation_published",
    entityType: "residence_regulation_versions",
    entityId: draftId,
    oldValue: result.previous_version_number ? { version_number: result.previous_version_number, content_hash: result.previous_hash ?? null } : null,
    newValue: { residence_id: params.residenceId, version_number: nextNumber, source, content_hash: hash, format: params.cleanupPath ? "pdf" : "text" },
  });

  return { ok: true, versionNumber: nextNumber };
}
