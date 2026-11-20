"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { MAX_AMOUNT_ARS, MAX_AMOUNT_USD, parseOptionalAmount } from "@/lib/payments/amounts";
import { extensionForMime, resolveDocumentType, toTypedBlob } from "@/lib/files/sniffFile";
import { safeFilename } from "@/lib/files/safeFilename";

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
    .select("id, status, residence_id, student_profile_id, student_profiles(user_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  const studentUserId = (application.student_profiles as unknown as { user_id: string } | null)?.user_id;
  if (studentUserId !== sessionUser.id) {
    return { status: "error", message: "Esta solicitud no te pertenece." };
  }

  // El comprobante se carga (y se puede reemplazar) solo mientras la solicitud espera el pago a la residencia
  // (docs/04: `residence_payment_pending`). Después de "Pago recibido" ya es historia cerrada.
  if (application.status !== "residence_payment_pending") {
    return { status: "error", message: "Esta solicitud ya no está esperando tu pago a la residencia, así que no se puede cargar ni cambiar el comprobante." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Adjuntá un comprobante." };
  }
  if (file.size > MAX_PROOF_BYTES) return { status: "error", message: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }
  const realType = await resolveDocumentType(file);
  if (!realType) {
    return { status: "error", message: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }

  const concept = String(formData.get("payment_concept") ?? "").trim();
  if (!concept) return { status: "error", message: "Contanos qué pagaste (ej: matrícula, seña)." };
  if (concept.length > 200) return { status: "error", message: "El concepto es demasiado largo (máximo 200 caracteres)." };
  const arsParsed = parseOptionalAmount(formData.get("amount_ars"), MAX_AMOUNT_ARS, "pesos");
  if (!arsParsed.ok) return { status: "error", message: arsParsed.error };
  const usdParsed = parseOptionalAmount(formData.get("amount_usd"), MAX_AMOUNT_USD, "dólares");
  if (!usdParsed.ok) return { status: "error", message: usdParsed.error };
  const amountArs = arsParsed.value;
  const amountUsd = usdParsed.value;
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || null;
  if (paymentMethod && paymentMethod.length > 80) return { status: "error", message: "El medio de pago es demasiado largo (máximo 80 caracteres)." };

  const { data: payment } = await admin
    .from("external_residence_payments")
    .select("id, status, amount_reported_usd, amount_reported_ars, payment_concept, payment_method_to_residence, student_proof_file_id")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (!payment) return { status: "error", message: "No encontramos el registro de pago de esta solicitud." };

  // La residencia ya marcó "recibido": el comprobante del estudiante no se pisa (se chequea antes de subir el archivo).
  if (payment.status === "reported_received_by_residence") {
    return { status: "error", message: "La residencia ya registró tu pago, así que no se puede cambiar el comprobante." };
  }

  const ext = extensionForMime(realType);
  const path = `${applicationId}/student-proof-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, await toTypedBlob(file, realType), { contentType: realType });
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
      filename: safeFilename(file.name),
      mime_type: realType,
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
    await admin.storage.from("payment-proofs").remove([path]);
    return { status: "error", message: "No pudimos registrar el comprobante." };
  }


  const { error: updateError } = await admin
    .from("external_residence_payments")
    .update({
      status: "student_reference_uploaded",
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
    // Si había un comprobante previo (reemplazo), queda el valor anterior para auditoría.
    oldValue: payment.student_proof_file_id
      ? {
          student_proof_file_id: payment.student_proof_file_id,
          amount_reported_usd: payment.amount_reported_usd,
          amount_reported_ars: payment.amount_reported_ars,
          payment_concept: payment.payment_concept,
          payment_method_to_residence: payment.payment_method_to_residence,
        }
      : undefined,
    newValue: { student_proof_file_id: fileRow.id, amount_reported_usd: amountUsd, amount_reported_ars: amountArs, payment_concept: concept },
  });

  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}
