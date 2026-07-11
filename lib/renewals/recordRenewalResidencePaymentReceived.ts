import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

export type RecordRenewalResidencePaymentReceivedResult =
  | { ok: true; residenceId: string }
  | { ok: false; error: string };

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Docs/07 §16.2, docs/12 §13.2 — la residencia marca "Pago recibido"
 * para una renovación. Mismo patrón que `recordResidencePaymentReceived`
 * de la reserva inicial, con dos diferencias deliberadas:
 * (1) no crea una `reservations` nueva — la renovación extiende la
 * estadía sobre la reserva existente (docs/06 §14.2: "no crea una
 * reservation nueva"; la extensión real de `resident_stays` queda
 * pendiente, esa tabla todavía no existe — ver MEMORY.md);
 * (2) no descuenta `profile_availability` — el estudiante ya ocupa la
 * plaza, renovar no la vuelve a tomar.
 */
export async function recordRenewalResidencePaymentReceived(
  admin: SupabaseClient,
  params: {
    renewalOfferId: string;
    actorUserId: string;
    receivedAmountArs: number | null;
    receivedAmountUsd: number | null;
    paymentMethodLabel: string;
    confirmationAccepted: boolean;
    receiptFile: File | null;
  },
): Promise<RecordRenewalResidencePaymentReceivedResult> {
  const { data: offer } = await admin
    .from("renewal_offers")
    .select(
      "id, status, residence_id, student_profile_id, fee_base_usd, fee_base_ars, estimated_estured_fee_ars",
    )
    .eq("id", params.renewalOfferId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "No encontramos esa oferta." };

  // El pagador default del fee es el estudiante dueño de la renovación
  // (nunca `sent_by_user_id` — ese es el staff de la residencia que envió
  // la oferta). Un familiar puede terminar pagando, pero recién se sabe
  // con certeza cuando registre el comprobante manual (billing info).
  const { data: studentUser } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", offer.student_profile_id)
    .single();
  if (!studentUser) return { ok: false, error: "No encontramos al estudiante de esta renovación." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, offer.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esa residencia." };
  if (offer.status !== "residence_payment_pending") {
    return { ok: false, error: "Esta renovación no está esperando pago a la residencia." };
  }
  if (!params.confirmationAccepted) return { ok: false, error: "Tenés que confirmar que recibiste el pago." };
  if (!params.paymentMethodLabel) return { ok: false, error: "Indicá el medio de pago." };

  const { data: payment } = await admin
    .from("external_residence_payments")
    .select("id")
    .eq("renewal_offer_id", params.renewalOfferId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "No encontramos el registro de pago de esta renovación." };

  let receiptFileId: string | null = null;
  if (params.receiptFile && params.receiptFile.size > 0) {
    const receiptFile = params.receiptFile;
    if (receiptFile.size > MAX_RECEIPT_BYTES) return { ok: false, error: "El recibo no puede superar los 10MB." };
    if (!ALLOWED_RECEIPT_TYPES.includes(receiptFile.type)) {
      return { ok: false, error: "El recibo debe ser PDF, JPG, PNG o WebP." };
    }
    const ext = receiptFile.type === "application/pdf" ? "pdf" : receiptFile.type.split("/")[1];
    const path = `${params.renewalOfferId}/renewal-residence-receipt-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, receiptFile, { contentType: receiptFile.type });
    if (uploadError) {
      console.error("[renewals] receipt upload failed:", uploadError);
      return { ok: false, error: "No pudimos subir el recibo. Intentá de nuevo." };
    }
    const { data: fileRow, error: fileError } = await admin
      .from("files")
      .insert({
        owner_user_id: params.actorUserId,
        related_entity_type: "renewal_offers",
        related_entity_id: params.renewalOfferId,
        bucket: "payment-proofs",
        storage_path: path,
        filename: receiptFile.name,
        mime_type: receiptFile.type,
        size_bytes: receiptFile.size,
        visibility: "context_shared",
        document_type: "residence_payment_receipt",
        status: "uploaded",
        uploaded_by_user_id: params.actorUserId,
      })
      .select("id")
      .single();
    if (fileError || !fileRow) {
      console.error("[renewals] receipt file row failed:", fileError);
      return { ok: false, error: "No pudimos registrar el recibo." };
    }
    receiptFileId = fileRow.id;
  }

  const now = new Date();
  const feeDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const { error: paymentUpdateError } = await admin
      .from("external_residence_payments")
      .update({
        status: "reported_received_by_residence",
        amount_reported_usd: params.receivedAmountUsd ?? undefined,
        amount_reported_ars: params.receivedAmountArs ?? undefined,
        payment_method_to_residence: params.paymentMethodLabel,
        residence_receipt_file_id: receiptFileId,
        reported_received_by_user_id: params.actorUserId,
        reported_received_at: now.toISOString(),
      })
      .eq("id", payment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    const { data: feePayment, error: feeError } = await admin
      .from("estured_fee_payments")
      .insert({
        renewal_offer_id: offer.id,
        payer_user_id: studentUser.user_id,
        beneficiary_student_profile_id: offer.student_profile_id,
        status: "pending_payment_method",
        fee_base_usd: offer.fee_base_usd,
        fee_base_ars: offer.fee_base_ars,
        fee_amount_ars: offer.estimated_estured_fee_ars,
        expires_at: feeDeadline.toISOString(),
      })
      .select("id")
      .single();
    if (feeError || !feePayment) throw feeError;

    const { error: offerUpdateError } = await admin
      .from("renewal_offers")
      .update({ status: "estured_fee_pending", estured_fee_payment_id: feePayment.id })
      .eq("id", offer.id);
    if (offerUpdateError) throw offerUpdateError;

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: "residence_owner",
      action: "renewal_residence_payment_marked_received",
      entityType: "renewal_offers",
      entityId: offer.id,
      newValue: { estured_fee_payment_id: feePayment.id },
    });

    return { ok: true, residenceId: offer.residence_id };
  } catch (error) {
    console.error("[renewals] mark-received failed:", error);
    return { ok: false, error: "No pudimos procesar la confirmación. Intentá de nuevo." };
  }
}
