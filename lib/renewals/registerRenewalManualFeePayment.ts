import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

export type RegisterRenewalFeePaymentResult = { ok: true } | { ok: false; error: string };

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IVA_CONDITIONS = new Set(["consumidor_final", "responsable_inscripto", "monotributista", "exento"]);

/**
 * Docs/07 §17.3 — el estudiante (o familiar pagador) registra una
 * referencia de pago manual del fee de renovación. Mismo patrón que
 * `registerManualFeePayment` de la reserva inicial. Nunca confirma la
 * renovación por sí solo — queda pendiente de validación admin.
 */
export async function registerRenewalManualFeePayment(
  admin: SupabaseClient,
  params: {
    renewalOfferId: string;
    actorUserId: string;
    file: File;
    payerBillingName: string;
    payerBillingCuit: string | null;
    payerIvaCondition: string;
    paymentChannel: string | null;
    acknowledgeNoRefund: boolean;
  },
): Promise<RegisterRenewalFeePaymentResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select("id, status, student_profile_id, estured_fee_payment_id")
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No encontramos esa renovación." };

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", params.actorUserId)
    .maybeSingle();
  if (!studentProfile || studentProfile.id !== offer.student_profile_id) {
    return { ok: false, error: "Esta renovación no te pertenece." };
  }
  if (offer.status !== "estured_fee_pending") {
    return { ok: false, error: "Todavía no se habilitó el pago del fee para esta renovación." };
  }
  if (!offer.estured_fee_payment_id) return { ok: false, error: "No encontramos el fee de esta renovación." };

  if (params.file.size === 0) return { ok: false, error: "Adjuntá un comprobante de la transferencia." };
  if (params.file.size > MAX_PROOF_BYTES) return { ok: false, error: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(params.file.type)) {
    return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  }
  if (!params.payerBillingName) return { ok: false, error: "Ingresá el nombre para la Factura C." };
  if (!IVA_CONDITIONS.has(params.payerIvaCondition)) return { ok: false, error: "Condición de IVA inválida." };
  if (!params.acknowledgeNoRefund) {
    return { ok: false, error: "Tenés que confirmar que leíste la política de no reembolso." };
  }

  const ext = params.file.type === "application/pdf" ? "pdf" : params.file.type.split("/")[1];
  const path = `${params.renewalOfferId}/renewal-fee-proof-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, params.file, { contentType: params.file.type });
  if (uploadError) {
    console.error("[renewals] fee proof upload failed:", uploadError);
    return { ok: false, error: "No pudimos subir el archivo. Intentá de nuevo." };
  }

  const { data: fileRow, error: fileError } = await admin
    .from("files")
    .insert({
      owner_user_id: params.actorUserId,
      related_entity_type: "estured_fee_payments",
      related_entity_id: offer.estured_fee_payment_id,
      bucket: "payment-proofs",
      storage_path: path,
      filename: params.file.name,
      mime_type: params.file.type,
      size_bytes: params.file.size,
      visibility: "context_shared",
      document_type: "other",
      status: "uploaded",
      uploaded_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (fileError || !fileRow) {
    console.error("[renewals] fee proof file row failed:", fileError);
    return { ok: false, error: "No pudimos registrar el comprobante." };
  }

  const { error: updateError } = await admin
    .from("estured_fee_payments")
    .update({
      status: "pending_manual_payment",
      payment_provider: "manual",
      manual_payment_file_id: fileRow.id,
      payment_channel: params.paymentChannel,
      payer_billing_name: params.payerBillingName,
      payer_billing_cuit: params.payerBillingCuit,
      payer_iva_condition: params.payerIvaCondition,
    })
    .eq("id", offer.estured_fee_payment_id);
  if (updateError) {
    console.error("[renewals] fee proof update failed:", updateError);
    return { ok: false, error: "No pudimos registrar el pago." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "renewal_fee_manual_payment_registered",
    entityType: "estured_fee_payments",
    entityId: offer.estured_fee_payment_id,
  });

  return { ok: true };
}
