import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { assertResidenceAccess } from "@/lib/residences/access";

export type RecordResidencePaymentReceivedResult =
  | { ok: true; reservationId: string; residenceId: string }
  | { ok: false; error: string };

const CONSENT_VERSION = "v0.1-borrador";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

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
 *
 * Extraído del server action (Ciclo 19, GAPS.md — gap de arquitectura
 * detectado en el Ciclo 14) para que la lógica de negocio sea testeable
 * sin `next/headers`: recibe todo por parámetro, ninguna dependencia de
 * Next. El server action solo resuelve sesión, parsea `FormData` y llama
 * a esta función.
 */
export async function recordResidencePaymentReceived(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    actorUserId: string;
    receivedAmountArs: number | null;
    receivedAmountUsd: number | null;
    paymentMethodLabel: string;
    confirmationAccepted: boolean;
    receiptFile: File | null;
  },
): Promise<RecordResidencePaymentReceivedResult> {
  const { data: application } = await admin
    .from("application_requests")
    .select(
      "id, status, residence_id, student_profile_id, family_link_id, room_type_id, desired_start_date, initial_duration_months, academic_objective, snapshot_final_id, snapshot_original_id, created_by_user_id",
    )
    .eq("id", params.applicationId)
    .maybeSingle();
  if (!application) return { ok: false, error: "No encontramos esa solicitud." };

  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, application.residence_id);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esa residencia." };
  if (application.status !== "residence_payment_pending") {
    return { ok: false, error: "Esa solicitud no está esperando pago a la residencia." };
  }
  if (!params.confirmationAccepted) {
    return { ok: false, error: "Tenés que confirmar que recibiste el pago." };
  }
  if (!params.paymentMethodLabel) return { ok: false, error: "Indicá el medio de pago." };

  const { data: payment } = await admin
    .from("external_residence_payments")
    .select("id, status")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (!payment) return { ok: false, error: "No encontramos el registro de pago de esta solicitud." };

  // Recibo opcional (docs/03 §12.4: la residencia puede cargar evidencia propia).
  let receiptFileId: string | null = null;
  if (params.receiptFile && params.receiptFile.size > 0) {
    const receiptFile = params.receiptFile;
    if (receiptFile.size > MAX_RECEIPT_BYTES) {
      return { ok: false, error: "El recibo no puede superar los 10MB." };
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(receiptFile.type)) {
      return { ok: false, error: "El recibo debe ser PDF, JPG, PNG o WebP." };
    }
    const ext = receiptFile.type === "application/pdf" ? "pdf" : receiptFile.type.split("/")[1];
    const path = `${params.applicationId}/residence-receipt-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, receiptFile, { contentType: receiptFile.type });
    if (uploadError) {
      console.error("[payment] receipt upload failed:", uploadError);
      return { ok: false, error: "No pudimos subir el recibo. Intentá de nuevo." };
    }
    const { data: fileRow, error: fileError } = await admin
      .from("files")
      .insert({
        owner_user_id: params.actorUserId,
        related_entity_type: "application_requests",
        related_entity_id: params.applicationId,
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
      console.error("[payment] receipt file row failed:", fileError);
      return { ok: false, error: "No pudimos registrar el recibo." };
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
  if (!snapshot) return { ok: false, error: "No encontramos las condiciones finales de esta solicitud." };

  const now = new Date();
  const feeDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    const { error: consentError, data: consent } = await admin
      .from("consents")
      .insert({
        user_id: params.actorUserId,
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
        amount_reported_usd: params.receivedAmountUsd ?? undefined,
        amount_reported_ars: params.receivedAmountArs ?? undefined,
        payment_method_to_residence: params.paymentMethodLabel,
        residence_receipt_file_id: receiptFileId,
        reported_received_by_user_id: params.actorUserId,
        reported_received_at: now.toISOString(),
        mark_received_consent_id: consent.id,
      })
      .eq("id", payment.id);
    if (paymentUpdateError) throw paymentUpdateError;

    const { data: reservation, error: reservationError } = await admin
      .from("reservations")
      .insert({
        application_request_id: params.applicationId,
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
      .eq("id", params.applicationId);
    if (applicationUpdateError) throw applicationUpdateError;

    await admin.from("application_status_events").insert({
      application_request_id: params.applicationId,
      from_status: "residence_payment_pending",
      to_status: "residence_payment_reported",
      changed_by_user_id: params.actorUserId,
      changed_by_role: "residence_owner",
    });
    await admin.from("application_status_events").insert({
      application_request_id: params.applicationId,
      from_status: "residence_payment_reported",
      to_status: "converted_to_reservation",
      changed_by_role: "system",
      reason_text: "Reserva y fee EstuRed creados automáticamente.",
    });

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: "residence_owner",
      action: "residence_payment_marked_received",
      entityType: "application_requests",
      entityId: params.applicationId,
      newValue: { reservation_id: reservation.id, estured_fee_payment_id: feePayment.id },
    });

    return { ok: true, reservationId: reservation.id, residenceId: application.residence_id };
  } catch (error) {
    console.error("[payment] mark-received failed:", error);
    return { ok: false, error: "No pudimos procesar la confirmación. Intentá de nuevo." };
  }
}
