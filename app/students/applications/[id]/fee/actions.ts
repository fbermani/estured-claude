"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { loadActiveFamilyLink } from "@/lib/family/access";
import { normalizeBillingTaxId } from "@/lib/family/familyProfile";

export type RegisterFeePaymentState = { status: "idle" | "error" | "saved"; message?: string };

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IVA_CONDITIONS = new Set(["consumidor_final", "responsable_inscripto", "monotributista", "exento"]);

/**
 * Docs/07 §17.3 — el estudiante o el familiar pagador (DR4: el familiar
 * vinculado designado como `payer_user_id`) registra una referencia de pago
 * manual del fee. Queda
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
    .select("id, status, student_profile_id, student_profiles(user_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  const studentUserId = (application.student_profiles as unknown as { user_id: string } | null)?.user_id;
  // Beneficiario, o familiar con vínculo ACTIVO con el beneficiario (DR4). Además tiene que ser el pagador designado (abajo).
  const isBeneficiary = studentUserId === sessionUser.id;
  if (!isBeneficiary) {
    // Se revalida EN EL MOMENTO DEL PAGO: vínculo activo y permiso de pagar (puede haberse revocado después de designarlo).
    const link = await loadActiveFamilyLink(admin, sessionUser.id, application.student_profile_id as string);
    if (!link) return { status: "error", message: "Esta solicitud no te pertenece." };
    if (link.permissions.can_pay_estured_fee !== true) {
      return { status: "error", message: "Ya no tenés permitido pagar el fee de esta reserva." };
    }
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

  // El comprobante lo sube el pagador designado del fee (quien envió la solicitud).
  const { data: designatedFee, error: designatedFeeError } = await admin
    .from("estured_fee_payments")
    .select("payer_user_id, status, expires_at")
    .eq("id", reservation.estured_fee_payment_id)
    .maybeSingle();
  if (designatedFeeError) {
    console.error("[fee] no se pudo leer el fee:", designatedFeeError);
    return { status: "error", message: "No pudimos verificar el pago. Probá de nuevo en unos minutos." };
  }
  if (!designatedFee || designatedFee.payer_user_id !== sessionUser.id) {
    return { status: "error", message: "El pago lo hace quien está designado como pagador de esta reserva." };
  }
  if (designatedFee.status !== "pending_payment_method") {
    return { status: "error", message: "Ya hay un comprobante registrado para este pago." };
  }
  if (designatedFee.expires_at && new Date(designatedFee.expires_at as string) < new Date()) {
    return { status: "error", message: "El plazo para pagar este fee ya venció. Escribile a EstuRed desde Soporte." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Adjuntá un comprobante de la transferencia." };
  }
  if (file.size > MAX_PROOF_BYTES) return { status: "error", message: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { status: "error", message: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }

  const billingName = String(formData.get("payer_billing_name") ?? "").trim().replace(/\s+/g, " ");
  if (!billingName) return { status: "error", message: "Ingresá el nombre para la Factura C." };
  if (billingName.length > 120) return { status: "error", message: "El nombre para la factura es demasiado largo (máximo 120 caracteres)." };
  const billingCuitRaw = String(formData.get("payer_billing_cuit") ?? "").trim();
  let billingCuit: string | null = null;
  if (billingCuitRaw) {
    billingCuit = normalizeBillingTaxId(billingCuitRaw);
    if (!billingCuit) return { status: "error", message: "Revisá el CUIT/DNI: el CUIT lleva 11 dígitos válidos y el DNI 7 u 8." };
  }
  const ivaCondition = String(formData.get("payer_iva_condition") ?? "consumidor_final");
  if (!IVA_CONDITIONS.has(ivaCondition)) return { status: "error", message: "Condición de IVA inválida." };
  const paymentChannel = String(formData.get("payment_channel") ?? "").trim() || null;
  if (paymentChannel && paymentChannel.length > 80) {
    return { status: "error", message: "El medio de pago es demasiado largo (máximo 80 caracteres)." };
  }
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

  // Compare-and-set: solo si el fee sigue esperando el pago, no venció y el pagador sigue siendo quien lo registra (un
  // familiar recién des-designado, o un comprobante ya cargado, no se pisan).
  const { data: updatedRows, error: updateError } = await admin
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
    .eq("id", reservation.estured_fee_payment_id)
    .eq("status", "pending_payment_method")
    .eq("payer_user_id", sessionUser.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .select("id");
  if (updateError || !updatedRows || updatedRows.length === 0) {
    if (updateError) console.error("[fee] update failed:", updateError);
    // El comprobante subido no quedó asociado a ningún pago: se limpia (mejor esfuerzo).
    await admin.from("files").delete().eq("id", fileRow.id);
    await admin.storage.from("payment-proofs").remove([path]);
    return {
      status: "error",
      message: updateError
        ? "No pudimos registrar el pago."
        : "El pago ya no se puede registrar: cambió el pagador, el plazo venció o ya hay un comprobante cargado. Actualizá la página.",
    };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: isBeneficiary ? "student" : "family_member",
    action: "estured_fee_manual_payment_registered",
    entityType: "estured_fee_payments",
    entityId: reservation.estured_fee_payment_id,
  });

  revalidatePath(`/students/applications/${applicationId}/fee`);
  return { status: "saved" };
}
