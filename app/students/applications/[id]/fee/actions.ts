"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";

export type RegisterFeePaymentState = { status: "idle" | "error" | "saved"; message?: string };

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IVA_CONDITIONS = new Set(["consumidor_final", "responsable_inscripto", "monotributista", "exento"]);

/**
 * Docs/07 §17.3 — el estudiante (o familiar pagador, no implementado
 * todavía) registra una referencia de pago manual del fee. Queda
 * pendiente de validación admin (§17.4) — esto NUNCA confirma la
 * reserva por sí solo.
 */
export async function registerManualFeePayment(
  applicationId: string,
  _prev: RegisterFeePaymentState,
  formData: FormData,
): Promise<RegisterFeePaymentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, student_profiles(user_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  const studentUserId = (application.student_profiles as unknown as { user_id: string } | null)?.user_id;
  if (studentUserId !== sessionUser.id) {
    return { status: "error", message: "Esta solicitud no te pertenece." };
  }
  if (application.status !== "converted_to_reservation") {
    return { status: "error", message: "Todavía no se habilitó el pago del fee para esta solicitud." };
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, estured_fee_payment_id, status")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (!reservation?.estured_fee_payment_id) {
    return { status: "error", message: "No encontramos el fee de esta reserva." };
  }
  if (reservation.status !== "pending_estured_fee") {
    return { status: "error", message: "El fee de esta reserva ya no está pendiente." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Adjuntá un comprobante de la transferencia." };
  }
  if (file.size > MAX_PROOF_BYTES) return { status: "error", message: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }

  const billingName = String(formData.get("payer_billing_name") ?? "").trim();
  if (!billingName) return { status: "error", message: "Ingresá el nombre para la Factura C." };
  const billingCuit = String(formData.get("payer_billing_cuit") ?? "").trim() || null;
  const ivaCondition = String(formData.get("payer_iva_condition") ?? "consumidor_final");
  if (!IVA_CONDITIONS.has(ivaCondition)) return { status: "error", message: "Condición de IVA inválida." };
  const paymentChannel = String(formData.get("payment_channel") ?? "").trim() || null;
  if (formData.get("acknowledge_no_refund") !== "on") {
    return { status: "error", message: "Tenés que confirmar que leíste la política de no reembolso." };
  }

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${applicationId}/fee-proof-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("[fee] upload failed:", uploadError);
    return { status: "error", message: "No pudimos subir el archivo. Intentá de nuevo." };
  }

  const { data: fileRow, error: fileError } = await admin
    .from("files")
    .insert({
      owner_user_id: sessionUser.id,
      related_entity_type: "estured_fee_payments",
      related_entity_id: reservation.estured_fee_payment_id,
      bucket: "payment-proofs",
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "other",
      status: "uploaded",
      uploaded_by_user_id: sessionUser.id,
    })
    .select("id")
    .single();
  if (fileError || !fileRow) {
    console.error("[fee] file row failed:", fileError);
    return { status: "error", message: "No pudimos registrar el comprobante." };
  }

  const { error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      status: "pending_manual_payment",
      payment_provider: "manual",
      manual_payment_file_id: fileRow.id,
      payment_channel: paymentChannel,
      payer_billing_name: billingName,
      payer_billing_cuit: billingCuit,
      payer_iva_condition: ivaCondition,
    })
    .eq("id", reservation.estured_fee_payment_id);
  if (updateError) {
    console.error("[fee] update failed:", updateError);
    return { status: "error", message: "No pudimos registrar el pago." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "student",
    action: "estured_fee_manual_payment_registered",
    entityType: "estured_fee_payments",
    entityId: reservation.estured_fee_payment_id,
  });

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}
