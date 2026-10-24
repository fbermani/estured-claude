import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog, alertAdminsOfAuditFailure } from "@/lib/audit";
import { removeWaitlistEntriesOnConfirmedReservation } from "@/lib/waitlist-entries/removeWaitlistEntriesOnConfirmedReservation";
import { promoteNextQueuedApplication } from "@/lib/applications/roomTypeQueue";
import { insertReceiptWithRetry } from "@/lib/receipts/receiptNumber";
import { resolveStayChangeIntentOnReservation } from "@/lib/stayChange/resolveStayChangeIntent";

type ConfirmResult =
  | { ok: true; reservationId: string; receiptId: string; verificationCode: string }
  | { ok: false; error: string };

/**
 * Docs/07 §18.1-19.1 — "Internal Action" invocada por: webhook de pago
 * (fase siguiente, no implementada), admin valida pago manual, sistema.
 * Confirma la reserva, cierra otras solicitudes activas del estudiante,
 * descuenta disponibilidad y genera el comprobante (sin PDF real todavía
 * — ver migración 0011). La emisión de Factura C real (TusFacturas.app)
 * queda pendiente de credenciales; acá solo se deja `fiscal_invoice_status
 * = pending_issue` para que un job/admin la reintente cuando exista la
 * integración.
 */
export async function confirmReservationAfterFeePaid(
  admin: SupabaseClient,
  params: { feePaymentId: string; actorUserId: string | null; actorRole: string },
): Promise<ConfirmResult> {
  const { data: feePayment } = await admin
    .from("estured_fee_payments")
    .select("id, status, reservation_id, payer_user_id, beneficiary_student_profile_id")
    .eq("id", params.feePaymentId)
    .maybeSingle();
  if (!feePayment || !feePayment.reservation_id) return { ok: false, error: "No encontramos el pago del fee." };

  const { data: reservation } = await admin
    .from("reservations")
    .select(
      "id, application_request_id, student_profile_id, residence_id, room_type_id, snapshot_id, external_residence_payment_id, start_date",
    )
    .eq("id", feePayment.reservation_id)
    .single();
  if (!reservation) return { ok: false, error: "No encontramos la reserva asociada." };

  const { data: residencePayment } = await admin
    .from("external_residence_payments")
    .select("status, amount_reported_usd, amount_reported_ars, reported_received_at")
    .eq("id", reservation.external_residence_payment_id)
    .single();
  if (residencePayment?.status !== "reported_received_by_residence") {
    return { ok: false, error: "El pago a la residencia todavía no fue confirmado." };
  }

  const now = new Date();

  const { error: reservationError } = await admin
    .from("reservations")
    .update({ status: "confirmed", confirmed_at: now.toISOString() })
    .eq("id", reservation.id);
  if (reservationError) return { ok: false, error: "No pudimos confirmar la reserva." };

  // DR3 "Quiero cambiar": si tenía un aviso abierto y esta reserva es en otra residencia, se resuelve y la residencia
  // actual recibe SOLO la fecha de ingreso (sin nombrar la nueva). Nunca lanza ni cierra la estadía actual (D11).
  await resolveStayChangeIntentOnReservation(admin, {
    studentProfileId: reservation.student_profile_id,
    newReservationId: reservation.id,
    newResidenceId: reservation.residence_id,
    newStartDate: (reservation.start_date as string | null) ?? null,
    newApplicationId: reservation.application_request_id as string,
  });

  // Docs/06 §27.8/§08 §6.10: sale automáticamente de otras listas de
  // espera al confirmar una reserva. Nunca lanza — no debe poder tumbar
  // la confirmación real.
  await removeWaitlistEntriesOnConfirmedReservation(admin, { studentProfileId: reservation.student_profile_id });

  // Cierra otras solicitudes activas del mismo estudiante (docs/07 §18.2) —
  // en la práctica siempre están en paused_due_to_other_active_request,
  // porque establishContact ya las pausó (docs/00 §9, Ciclo 7).
  const { data: siblings } = await admin
    .from("application_requests")
    .select("id, status, room_type_id")
    .eq("student_profile_id", reservation.student_profile_id)
    .neq("id", reservation.application_request_id)
    .eq("status", "paused_due_to_other_active_request");
  for (const sibling of siblings ?? []) {
    await admin
      .from("application_requests")
      .update({ status: "closed_due_to_other_confirmed_reservation" })
      .eq("id", sibling.id);
    await admin.from("application_status_events").insert({
      application_request_id: sibling.id,
      from_status: "paused_due_to_other_active_request",
      to_status: "closed_due_to_other_confirmed_reservation",
      changed_by_role: "system",
      reason_text: "El estudiante confirmó una reserva en otra solicitud.",
    });
    if (sibling.room_type_id) {
      await promoteNextQueuedApplication(admin, sibling.room_type_id);
    }
  }

  // Descuenta disponibilidad declarada (Modo Perfil Verificado, docs/07 §18.2).
  const { data: availability } = await admin
    .from("profile_availability")
    .select("id, available_count, status")
    .eq("room_type_id", reservation.room_type_id)
    .maybeSingle();
  if (availability) {
    const nextCount = Math.max(0, (availability.available_count ?? 1) - 1);
    await admin
      .from("profile_availability")
      .update({
        available_count: nextCount,
        status: nextCount === 0 ? "full" : availability.status,
      })
      .eq("id", availability.id);
  }

  // Datos para el comprobante (docs/06 §13.3 — congelados al momento de emitir).
  const [{ data: snapshot }, { data: student }, { data: residence }, { data: roomType }] =
    await Promise.all([
      admin
        .from("application_snapshots")
        .select(
          "monthly_price_usd, monthly_price_ars, enrollment_fee_usd, enrollment_fee_ars, deposit_usd, deposit_ars, initial_duration_months, adjustment_policy, exchange_rate_ars_per_usd, exchange_rate_date",
        )
        .eq("id", reservation.snapshot_id)
        .single(),
      admin
        .from("student_profiles")
        .select("first_name, last_initial, academic_objective")
        .eq("id", reservation.student_profile_id)
        .single(),
      admin.from("residences").select("name, public_area").eq("id", reservation.residence_id).single(),
      admin.from("room_types").select("name").eq("id", reservation.room_type_id).single(),
    ]);

  const { data: application } = await admin
    .from("application_requests")
    .select("desired_start_date, academic_objective")
    .eq("id", reservation.application_request_id)
    .single();

  const { data: fullFeePayment } = await admin
    .from("estured_fee_payments")
    .select(
      "fee_amount_ars, fee_amount_usd, payment_currency, payer_billing_name, paid_at",
    )
    .eq("id", feePayment.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const receiptPayload = {
    reservation_id: reservation.id,
    issued_at: now.toISOString(),
    student: { first_name: student?.first_name, last_initial: student?.last_initial },
    residence: { name: residence?.name, public_area: residence?.public_area },
    room_type: roomType?.name,
    desired_start_date: application?.desired_start_date,
    initial_duration_months: snapshot?.initial_duration_months,
    academic_objective: application?.academic_objective ?? student?.academic_objective,
    final_conditions: snapshot,
    residence_payment_confirmed: true,
    // H07 / docs/01 §14: monto que la residencia informó como recibido (congelado al emitir).
    residence_payment: {
      amount_usd: residencePayment?.amount_reported_usd ?? null,
      amount_ars: residencePayment?.amount_reported_ars ?? null,
      reported_at: residencePayment?.reported_received_at ?? null,
    },
    estured_fee: {
      amount_ars: fullFeePayment?.fee_amount_ars,
      amount_usd: fullFeePayment?.fee_amount_usd,
      currency: fullFeePayment?.payment_currency,
      paid_at: fullFeePayment?.paid_at,
      // Solo el nombre/razón social: CUIT, condición de IVA y email del pagador NO van en el payload
      // (la policy de `booking_receipts` deja leer la fila completa a cualquier usuario activo de la
      // residencia; esos datos viven en `estured_fee_payments`, que sí tiene su propia policy).
      payer_billing_name: fullFeePayment?.payer_billing_name,
    },
    adjustment_policy: snapshot?.adjustment_policy,
    disclaimer:
      "EstuRed es una plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el alojamiento ni garantiza la conducta de las partes.",
  };

  // Número y código nuevos en cada intento; reintenta ante colisión del número (23505, hasta 3 veces).
  const {
    data: receipt,
    error: receiptError,
    verificationCode,
    attempts: receiptAttempts,
  } = await insertReceiptWithRetry<{ id: string }>("booking", ({ receiptNumber, verificationCode }) =>
    admin
      .from("booking_receipts")
      .insert({
        reservation_id: reservation.id,
        student_profile_id: reservation.student_profile_id,
        payer_user_id: feePayment.payer_user_id,
        residence_id: reservation.residence_id,
        status: "issued",
        receipt_number: receiptNumber,
        verification_code: verificationCode,
        qr_code_value: `${appUrl}/verify/${verificationCode}`,
        issued_at: now.toISOString(),
        receipt_payload: receiptPayload,
      })
      .select("id")
      .single(),
  );
  if (receiptError || !receipt) {
    console.error("[fee] booking_receipts insert failed:", receiptError);
    // Docs/07 §19.1: si falla el comprobante, la reserva sigue confirmed — no revertimos.
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "booking_receipt_generation_failed",
      entityType: "reservations",
      entityId: reservation.id,
      newValue: { attempts: receiptAttempts, error_code: receiptError?.code ?? null },
      source: "system",
    });
    return { ok: true, reservationId: reservation.id, receiptId: "", verificationCode: "" };
  }

  await admin.from("reservations").update({ booking_receipt_id: receipt.id }).eq("id", reservation.id);
  await admin.from("estured_fee_payments").update({ fiscal_invoice_status: "pending_issue" }).eq("id", feePayment.id);

  const audited = await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "reservation_confirmed",
    entityType: "reservations",
    entityId: reservation.id,
    newValue: { booking_receipt_id: receipt.id, verification_code: verificationCode },
    source: params.actorRole === "admin" || params.actorRole === "superadmin" ? "admin" : "system",
  });
  if (!audited) {
    await alertAdminsOfAuditFailure(admin, {
      action: "reservation_confirmed",
      entityType: "reservations",
      entityId: reservation.id,
    });
  }

  return { ok: true, reservationId: reservation.id, receiptId: receipt.id, verificationCode };
}
