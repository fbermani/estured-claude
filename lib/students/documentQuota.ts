import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SEG14-03: cuota acumulada de documentos por estudiante (el tope de 10 MB es por archivo; sin cuota, un usuario podía repetir
 * subidas válidas hasta agotar el Storage compartido). Los documentos no se borran ni reemplazan (trazabilidad), por eso se cuenta
 * todo lo subido al bucket `student-documents` para ese perfil.
 */
export const STUDENT_DOCUMENT_MAX_FILES = 40;
export const STUDENT_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;
/** Freno persistente de subidas por usuario (complementa la cuota: la cuota es el límite duro, esto frena ráfagas). */
export const STUDENT_DOCUMENT_UPLOADS_PER_HOUR = 20;

export const STUDENT_DOCUMENT_QUOTA_MESSAGE =
  "Llegaste al límite de documentos que podés subir. Si necesitás cargar otro, escribinos a Soporte.";

export type DocumentUsage = { files: number; bytes: number };

export function exceedsDocumentQuota(usage: DocumentUsage, incomingBytes = 0): boolean {
  return usage.files + (incomingBytes > 0 ? 1 : 0) > STUDENT_DOCUMENT_MAX_FILES || usage.bytes + incomingBytes > STUDENT_DOCUMENT_MAX_BYTES;
}

/** Uso actual (cantidad y bytes) de documentos del estudiante. `null` si la consulta falla (quien llama corta: falla cerrado). */
export async function studentDocumentUsage(admin: SupabaseClient, studentProfileId: string): Promise<DocumentUsage | null> {
  const { data, error } = await admin
    .from("files")
    .select("size_bytes")
    .eq("bucket", "student-documents")
    .eq("related_entity_type", "student_profiles")
    .eq("related_entity_id", studentProfileId)
    .limit(STUDENT_DOCUMENT_MAX_FILES + 50);
  if (error || !data) return null;
  return { files: data.length, bytes: data.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0) };
}
