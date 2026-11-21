import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extensionForMime, resolveDocumentType, toTypedBlob, type DocumentMime } from "@/lib/files/sniffFile";
import { safeFilename } from "@/lib/files/safeFilename";

/**
 * Comprobante OPCIONAL de «Ya pagué» (DR63 (e), docs/07 §16.1 y §16.4). Va al bucket privado `payment-proofs`, con una fila en `files`
 * (RLS sin policies: solo service role). Nadie lo lee con la API: la residencia lo abre por un link firmado corto que genera
 * `openStudentPaymentProof` tras verificar `payments.residence` (`lib/applications/residencePaymentReview.ts`).
 */

export const MAX_PROOF_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const PROOF_BUCKET = "payment-proofs";
export const PROOF_DOCUMENT_TYPE = "student_payment_proof_to_residence";

export type ValidatedProof = { file: File; realType: DocumentMime };

/** Valida un comprobante (tamaño, tipo declarado y firma real del archivo). `null` y archivos vacíos = sin comprobante (es opcional). */
export async function validateOptionalProof(
  input: FormDataEntryValue | null,
): Promise<{ ok: true; proof: ValidatedProof | null } | { ok: false; error: string }> {
  if (!(input instanceof File) || input.size === 0) return { ok: true, proof: null };
  if (input.size > MAX_PROOF_BYTES) return { ok: false, error: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_PROOF_TYPES.includes(input.type)) return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  const realType = await resolveDocumentType(input);
  if (!realType) return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  return { ok: true, proof: { file: input, realType } };
}

/** Sube el comprobante y crea su fila en `files`. Devuelve el id, o `null` si falló (no deja el objeto huérfano). */
export async function storeStudentPaymentProof(
  admin: SupabaseClient,
  params: { applicationId: string; ownerUserId: string; proof: ValidatedProof },
): Promise<{ fileId: string; storagePath: string } | null> {
  const { file, realType } = params.proof;
  const path = `${params.applicationId}/student-proof-${crypto.randomUUID()}.${extensionForMime(realType)}`;
  const { error: uploadError } = await admin.storage.from(PROOF_BUCKET).upload(path, await toTypedBlob(file, realType), { contentType: realType });
  if (uploadError) {
    console.error("[payment-proof] upload failed:", uploadError.message);
    return null;
  }
  const { data: row, error: rowError } = await admin
    .from("files")
    .insert({
      owner_user_id: params.ownerUserId,
      related_entity_type: "application_requests",
      related_entity_id: params.applicationId,
      bucket: PROOF_BUCKET,
      storage_path: path,
      filename: safeFilename(file.name),
      mime_type: realType,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: PROOF_DOCUMENT_TYPE,
      status: "uploaded",
      uploaded_by_user_id: params.ownerUserId,
    })
    .select("id")
    .single();
  if (rowError || !row) {
    console.error("[payment-proof] file row failed:", rowError?.code, rowError?.message);
    await admin.storage.from(PROOF_BUCKET).remove([path]);
    return null;
  }
  return { fileId: row.id as string, storagePath: path };
}

/**
 * Borra un comprobante (fila de `files` y objeto). Mejor esfuerzo, con orden seguro: primero la fila; si no se pudo borrar (p. ej. FK
 * porque `external_residence_payments.student_proof_file_id` todavía lo referencia) el objeto se conserva, para no dejar una fila
 * apuntando a un archivo inexistente.
 */
export async function discardStoredProof(admin: SupabaseClient, stored: { fileId: string; storagePath: string }): Promise<void> {
  const { error } = await admin.from("files").delete().eq("id", stored.fileId);
  if (error) {
    console.error("[payment-proof] discard: no se pudo borrar la fila de files:", error.code, error.message);
    return;
  }
  await admin.storage.from(PROOF_BUCKET).remove([stored.storagePath]);
}

/** Descarta un comprobante anterior por id (el reemplazado por uno nuevo). Solo toca filas del bucket y tipo de comprobante de pago. */
export async function discardProofFileById(admin: SupabaseClient, fileId: string): Promise<void> {
  const { data: file } = await admin.from("files").select("id, bucket, storage_path, document_type").eq("id", fileId).maybeSingle();
  if (!file || file.bucket !== PROOF_BUCKET || file.document_type !== PROOF_DOCUMENT_TYPE) return;
  await discardStoredProof(admin, { fileId, storagePath: file.storage_path as string });
}
