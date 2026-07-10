import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordResidencePaymentReceived } from "@/lib/reservations/recordResidencePaymentReceived";

/**
 * Extraída del server action `markResidencePaymentReceived` (Ciclo 19,
 * GAPS.md — gap de arquitectura detectado en el Ciclo 14). Cubre el otro
 * lado del loop de pagos que `confirmAfterFeePaid.test.ts` (Ciclo 14) no
 * tocaba: la creación de `reservations`/`estured_fee_payments` a partir
 * del pago a la residencia, antes de que exista el fee.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("recordResidencePaymentReceived (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let mainAppId: string;
  let snapshotId: string;
  let residencePaymentId: string;
  let reservationId: string | null = null;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin
      .from("users")
      .select("id")
      .eq("email", "owner.residencia.norte@example.com")
      .single();
    ownerId = owner!.id;

    const { data: studentUser } = await admin
      .from("users")
      .select("id")
      .eq("email", "lucia.fernandez@example.com")
      .single();
    studentUserId = studentUser!.id;

    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", studentUserId)
      .single();
    studentProfileId = studentProfile!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 19 — pago residencia)",
        slug: `residencia-test-pago-residencia-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        responsible_name: "Test",
        responsible_contact: "+54 9 11 0000-0000",
        total_capacity: 5,
        created_by: ownerId,
      })
      .select("id")
      .single();
    residenceId = residence!.id;

    // El owner necesita `residence_users` activo para pasar `assertResidenceAccess`
    // — a diferencia de los fixtures de otros tests, acá SÍ importa (es lo que se prueba).
    await admin.from("residence_users").insert({
      residence_id: residenceId,
      user_id: ownerId,
      role: "owner",
      is_active: true,
    });

    const { data: roomType } = await admin
      .from("room_types")
      .insert({
        residence_id: residenceId,
        name: "Individual",
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        adjustment_policy: "quarterly",
      })
      .select("id")
      .single();
    roomTypeId = roomType!.id;

    const { data: snapshot } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: residenceId,
        room_type_id: roomTypeId,
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        exchange_rate_ars_per_usd: 1520,
        exchange_rate_source: "test",
        exchange_rate_date: new Date().toISOString().slice(0, 10),
        initial_duration_months: 6,
        adjustment_policy: "quarterly",
        deposit_excluded_from_fee: true,
      })
      .select("id")
      .single();
    snapshotId = snapshot!.id;

    const { data: mainApp } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: studentProfileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "residence_payment_pending",
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_original_id: snapshotId,
        created_by_user_id: studentUserId,
      })
      .select("id")
      .single();
    mainAppId = mainApp!.id;
    await admin.from("application_snapshots").update({ application_request_id: mainAppId }).eq("id", snapshotId);

    const { data: residencePayment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: mainAppId,
        residence_id: residenceId,
        student_profile_id: studentProfileId,
        status: "pending",
      })
      .select("id")
      .single();
    residencePaymentId = residencePayment!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (reservationId) {
      await admin
        .from("reservations")
        .update({ estured_fee_payment_id: null, booking_receipt_id: null })
        .eq("id", reservationId);
      await admin.from("estured_fee_payments").delete().eq("reservation_id", reservationId);
      await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", residencePaymentId);
      await admin.from("reservations").delete().eq("id", reservationId);
    }
    await admin.from("external_residence_payments").delete().eq("id", residencePaymentId);
    await admin.from("application_requests").delete().eq("id", mainAppId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    await admin.from("residences").delete().eq("id", residenceId);
  });

  it("rechaza si el actor no tiene acceso activo a esa residencia", async () => {
    const result = await recordResidencePaymentReceived(admin, {
      applicationId: mainAppId,
      actorUserId: studentUserId, // no tiene residence_users para esta residencia
      receivedAmountArs: 456000,
      receivedAmountUsd: null,
      paymentMethodLabel: "Transferencia bancaria",
      confirmationAccepted: true,
      receiptFile: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no tenés acceso/i);
  });

  it("rechaza si la solicitud no está esperando pago a la residencia", async () => {
    await admin.from("application_requests").update({ status: "contact_established" }).eq("id", mainAppId);

    const result = await recordResidencePaymentReceived(admin, {
      applicationId: mainAppId,
      actorUserId: ownerId,
      receivedAmountArs: 456000,
      receivedAmountUsd: null,
      paymentMethodLabel: "Transferencia bancaria",
      confirmationAccepted: true,
      receiptFile: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/esperando pago/i);

    await admin.from("application_requests").update({ status: "residence_payment_pending" }).eq("id", mainAppId);
  });

  it("registra el pago recibido y crea la reserva con el fee pendiente", async () => {
    const result = await recordResidencePaymentReceived(admin, {
      applicationId: mainAppId,
      actorUserId: ownerId,
      receivedAmountArs: 456000,
      receivedAmountUsd: null,
      paymentMethodLabel: "Transferencia bancaria",
      confirmationAccepted: true,
      receiptFile: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.residenceId).toBe(residenceId);
    reservationId = result.reservationId;

    const { data: payment } = await admin
      .from("external_residence_payments")
      .select("status, payment_method_to_residence, reservation_id")
      .eq("id", residencePaymentId)
      .single();
    expect(payment!.status).toBe("reported_received_by_residence");
    expect(payment!.payment_method_to_residence).toBe("Transferencia bancaria");
    expect(payment!.reservation_id).toBe(result.reservationId);

    const { data: reservation } = await admin
      .from("reservations")
      .select("status, estured_fee_payment_id")
      .eq("id", result.reservationId)
      .single();
    expect(reservation!.status).toBe("pending_estured_fee");
    expect(reservation!.estured_fee_payment_id).not.toBeNull();

    const { data: feePayment } = await admin
      .from("estured_fee_payments")
      .select("status, fee_amount_ars")
      .eq("id", reservation!.estured_fee_payment_id)
      .single();
    expect(feePayment!.status).toBe("pending_payment_method");
    expect(feePayment!.fee_amount_ars).toBeGreaterThan(0);

    const { data: application } = await admin
      .from("application_requests")
      .select("status")
      .eq("id", mainAppId)
      .single();
    expect(application!.status).toBe("converted_to_reservation");
  });
});
