"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type UploadProofState = { status: "idle" | "error" | "saved"; message?: string };

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Docs/07 §16.1 — el estudiante sube un comprobante de referencia. Nunca
 * confirma la reserva por sí solo (docs/03 §12.4): solo la residencia
 * puede marcar "Pago recibido".
 */
export async function uploadResidencePaymentProof(
  applicationId: string,
  _prev: UploadProofState,
  formData: FormData,
): Promise<UploadProofState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: application } = await admin
    .from("application_requests")
    .select("id, residence_id, student_profile_id, student_profiles(user_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  const studentUserId = (application.student_profiles as unknown as { user_id: string } | null)?.user_id;
  if (studentUserId !== sessionUser.id) {
    return { status: "error", message: "Esta solicitud no te pertenece." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Adjuntá un comprobante." };
  }
  if (file.size > MAX_PROOF_BYTES) return { status: "error", message: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }

  const concept = String(formData.get("payment_concept") ?? "").trim();
  if (!concept) return { status: "error", message: "Contanos qué pagaste (ej: matrícula, seña)." };
  const amountArs = Number(formData.get("amount_ars") ?? 0) || null;
  const amountUsd = Number(formData.get("amount_usd") ?? 0) || null;
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || null;

  const { data: payment } = await admin
    .from("external_residence_payments")
    .select("id, status")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (!payment) return { status: "error", message: "No encontramos el registro de pago de esta solicitud." };

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${applicationId}/student-proof-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("[payment] upload failed:", uploadError);
    return { status: "error", message: "No pudimos subir el archivo. Intentá de nuevo." };
  }

  const { data: fileRow, error: fileError } = await admin
    .from("files")
    .insert({
      owner_user_id: sessionUser.id,
      related_entity_type: "application_requests",
      related_entity_id: applicationId,
      bucket: "payment-proofs",
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "student_payment_proof_to_residence",
      status: "uploaded",
      uploaded_by_user_id: sessionUser.id,
    })
    .select("id")
    .single();
  if (fileError || !fileRow) {
    console.error("[payment] file row failed:", fileError);
    return { status: "error", message: "No pudimos registrar el comprobante." };
  }

  // No pisa el estado si la residencia ya marcó "recibido" primero.
  const nextStatus = payment.status === "reported_received_by_residence" ? undefined : "student_reference_uploaded";

  const { error: updateError } = await admin
    .from("external_residence_payments")
    .update({
      ...(nextStatus ? { status: nextStatus } : {}),
      amount_reported_usd: amountUsd,
      amount_reported_ars: amountArs,
      payment_concept: concept,
      payment_method_to_residence: paymentMethod,
      student_proof_file_id: fileRow.id,
    })
    .eq("id", payment.id);
  if (updateError) {
    console.error("[payment] update failed:", updateError);
    return { status: "error", message: "No pudimos registrar el comprobante." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "residence_payment_proof_uploaded",
    entityType: "application_requests",
    entityId: applicationId,
  });

  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}
