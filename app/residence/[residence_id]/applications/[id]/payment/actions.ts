"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { assertResidenceAccess } from "@/lib/residences/access";
import { createAuditLog } from "@/lib/audit";
import { calculateFeeEstimate } from "@/lib/applications/fee";

export type MarkReceivedState = { status: "idle" | "error" | "saved"; message?: string };

const CONSENT_VERSION = "v0.1-borrador";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Docs/07 §16.2, docs/03 §12.5, docs/06 §12.1/§13.1/§13.2 — la residencia
 * marca "Pago recibido". Es la única acción que confirma la reserva; el
 * comprobante que subió el estudiante (si lo hizo) es solo referencia.
 *
 * En una sola operación: cierra `external_residence_payments`, crea
 * `reservations` (pending_estured_fee) y `estured_fee_payments`
 * (pending_payment_method, sin cobro — eso es la fase siguiente), y
 * mueve `application_requests.status` a `converted_to_reservation`
 * (docs/06 §13.1: "la entidad reserva toma el control").
 */
export async function markResidencePaymentReceived(
  applicationId: string,
  _prev: MarkReceivedState,
  formData: FormData,
): Promise<MarkReceivedState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: application } = await admin
    .from("application_requests")
    .select(
      "id, status, residence_id, student_profile_id, family_link_id, room_type_id, desired_start_date, initial_duration_months, academic_objective, snapshot_final_id, snapshot_original_id, created_by_user_id",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { status: "error", message: "No encontramos esa solicitud." };

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, application.residence_id);
  if (!hasAccess) return { status: "error", message: "No tenés acceso a esa residencia." };
  if (application.status !== "residence_payment_pending") {
    return { status: "error", message: "Esa solicitud no está esperando pago a la residencia." };
  }
  if (formData.get("confirmation_checkbox_accepted") !== "on") {
    return { status: "error", message: "Tenés que confirmar que recibiste el pago." };
  }

  const { data: payment } = await admin
    .from("external_residence_payments")
    .select("id, status")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (!payment) return { status: "error", message: "No encontramos el registro de pago de esta solicitud." };

  const receivedAmountArs = Number(formData.get("received_amount_ars") ?? 0) || null;
  const receivedAmountUsd = Number(formData.get("received_amount_usd") ?? 0) || null;
  const paymentMethodLabel = String(formData.get("payment_method_label") ?? "").trim();
  if (!paymentMethodLabel) return { status: "error", message: "Indicá el medio de pago." };

  // Recibo opcional (docs/03 §12.4: la residencia puede cargar evidencia propia).
  let receiptFileId: string | null = null;
  const receiptFile = formData.get("receipt_file");
  if (receiptFile instanceof File && receiptFile.size > 0) {
    if (receiptFile.size > MAX_RECEIPT_BYTES) {
      return { status: "error", message: "El recibo no puede superar los 10MB." };
    }
    if (!ALLOWED_TYPES.includes(receiptFile.type)) {
      return { status: "error", message: "El recibo debe ser PDF, JPG, PNG o WebP." };
    }
    const ext = receiptFile.type === "application/pdf" ? "pdf" : receiptFile.type.split("/")[1];
    const path = `${applicationId}/residence-receipt-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, receiptFile, { contentType: receiptFile.type });
    if (uploadError) {
      console.error("[payment] receipt upload failed:", uploadError);
      return { status: "error", message: "No pudimos subir el recibo. Intentá de nuevo." };
    }
    const { data: fileRow, error: fileError } = await admin
      .from("files")
      .insert({
        owner_user_id: sessionUser.id,
        related_entity_type: "application_requests",
        related_entity_id: applicationId,
        bucket: "payment-proofs",
        storage_path: path,
        filename: receiptFile.name,
        mime_type: receiptFile.type,
        size_bytes: receiptFile.size,
        visibility: "context_shared",
        document_type: "residence_payment_receipt",
        status: "uploaded",
        uploaded_by_user_id: sessionUser.id,
      })
      .select("id")
      .single();
    if (fileError || !fileRow) {
      console.error("[payment] receipt file row failed:", fileError);
      return { status: "error", message: "No pudimos registrar el recibo." };
    }
    receiptFileId = fileRow.id;
  }

  const snapshotId = application.snapshot_final_id ?? application.snapshot_original_id;
  const { data: snapshot } = await admin
    .from("application_snapshots")
    .select(
      "monthly_price_usd, enrollment_fee_usd, initial_duration_months, exchange_rate_ars_per_usd, place_id, estimated_estured_fee_ars, fee_base_usd, fee_base_ars",
    )
    .eq("id", snapshotId)
    .single();
  if (!snapshot) return { status: "error", message: "No encontramos las condiciones finales de esta solicitud." };

  const now = new Date();
  const feeDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const { error: consentError, data: consent } = await admin
      .from("consents")
      .insert({
        user_id: sessionUser.id,
        consent_type: "residence_payment_received",
        version: CONSENT_VERSION,
        related_entity_type: "external_residence_payments",
        related_entity_id: payment.id,
      })
      .select("id")
      .single();
    if (consentError || !consent) throw consentError;

    const { error: paymentUpdateError } = await admin
      .from("external_residence_payments")
      .update({
        status: "reported_received_by_residence",
        amount_reported_usd: receivedAmountUsd ?? undefined,
        amount_reported_ars: receivedAmountArs ?? undefined,
        payment_method_to_residence: paymentMethodLabel,
        residence_receipt_file_id: receiptFileId,
        reported_received_by_user_id: sessionUser.id,
        reported_received_at: now.toISOString(),
        mark_received_consent_id: consent.id,
      })
      .eq("id", payment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    const { data: reservation, error: reservationError } = await admin
      .from("reservations")
      .insert({
        application_request_id: applicationId,
        student_profile_id: application.student_profile_id,
        family_link_id: application.family_link_id,
        residence_id: application.residence_id,
        room_type_id: application.room_type_id,
        place_id: snapshot.place_id,
        status: "pending_estured_fee",
        start_date: application.desired_start_date,
        initial_duration_months: application.initial_duration_months,
        academic_objective: application.academic_objective,
        snapshot_id: snapshotId,
        external_residence_payment_id: payment.id,
      })
      .select("id")
      .single();
    if (reservationError || !reservation) throw reservationError;

    const { error: paymentReservationLinkError } = await admin
      .from("external_residence_payments")
      .update({ reservation_id: reservation.id })
      .eq("id", payment.id);
    if (paymentReservationLinkError) throw paymentReservationLinkError;

    const fee = calculateFeeEstimate({
      monthlyPriceUsd: Number(snapshot.monthly_price_usd),
      durationMonths: Number(snapshot.initial_duration_months),
      enrollmentFeeUsd: snapshot.enrollment_fee_usd ? Number(snapshot.enrollment_fee_usd) : null,
      arsPerUsd: Number(snapshot.exchange_rate_ars_per_usd),
    });

    const { data: feePayment, error: feeError } = await admin
      .from("estured_fee_payments")
      .insert({
        reservation_id: reservation.id,
        payer_user_id: application.created_by_user_id,
        beneficiary_student_profile_id: application.student_profile_id,
        status: "pending_payment_method",
        fee_base_usd: fee.feeBaseUsd,
        fee_base_ars: fee.feeBaseArs,
        fee_amount_ars: fee.estimatedFeeArs,
        expires_at: feeDeadline.toISOString(),
      })
      .select("id")
      .single();
    if (feeError || !feePayment) throw feeError;

    const { error: reservationUpdateError } = await admin
      .from("reservations")
      .update({ estured_fee_payment_id: feePayment.id })
      .eq("id", reservation.id);
    if (reservationUpdateError) throw reservationUpdateError;

    const { error: applicationUpdateError } = await admin
      .from("application_requests")
      .update({ status: "converted_to_reservation", payment_deadline_at: feeDeadline.toISOString() })
      .eq("id", applicationId);
    if (applicationUpdateError) throw applicationUpdateError;

    await admin.from("application_status_events").insert({
      application_request_id: applicationId,
      from_status: "residence_payment_pending",
      to_status: "residence_payment_reported",
      changed_by_user_id: sessionUser.id,
      changed_by_role: "residence_owner",
    });
    await admin.from("application_status_events").insert({
      application_request_id: applicationId,
      from_status: "residence_payment_reported",
      to_status: "converted_to_reservation",
      changed_by_role: "system",
      reason_text: "Reserva y fee EstuRed creados automáticamente.",
    });

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "residence_owner",
      action: "residence_payment_marked_received",
      entityType: "application_requests",
      entityId: applicationId,
      newValue: { reservation_id: reservation.id, estured_fee_payment_id: feePayment.id },
    });
  } catch (error) {
    console.error("[payment] mark-received failed:", error);
    return { status: "error", message: "No pudimos procesar la confirmación. Intentá de nuevo." };
  }

  revalidatePath(`/residence/${application.residence_id}/applications/${applicationId}`);
  revalidatePath(`/students/applications/${applicationId}`);
  return { status: "saved" };
}
