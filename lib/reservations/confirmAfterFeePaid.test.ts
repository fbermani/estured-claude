import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";

/**
 * Test de integración contra el Supabase real del proyecto (no hay
 * `supabase start` local instalado — ver GAPS.md). Se salta solo si
 * faltan credenciales (CI sin secrets, por ejemplo). Reusa usuarios
 * demo existentes (docs/17) en vez de crear usuarios de auth nuevos, y
 * limpia todo lo que crea en `afterAll`, respetando el orden de FKs
 * circulares ya documentado en MEMORY.md (reservations ↔
 * estured_fee_payments, reservations ↔ booking_receipts).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("confirmReservationAfterFeePaid (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let mainAppId: string;
  let siblingAppId: string;
  let snapshotId: string;
  let residencePaymentId: string;
  let reservationId: string;
  let feePaymentId: string;

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
        name: "Residencia Test Integración (Ciclo 13)",
        slug: `residencia-test-integracion-${Date.now()}`,
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

    await admin.from("profile_availability").insert({
      residence_id: residenceId,
      room_type_id: roomTypeId,
      status: "available_to_confirm",
      available_count: 2,
      last_confirmed_by: ownerId,
    });

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
        status: "converted_to_reservation",
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

    // Solicitud "hermana" pausada — debe cerrarse automáticamente al confirmar.
    const { data: siblingSnapshot } = await admin
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
    const { data: siblingApp } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: studentProfileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "paused_due_to_other_active_request",
        desired_start_date: "2026-09-01",
        initial_duration_months: 4,
        academic_objective: "Solicitud hermana de prueba (test de integración).",
        snapshot_original_id: siblingSnapshot!.id,
        created_by_user_id: studentUserId,
      })
      .select("id")
      .single();
    siblingAppId = siblingApp!.id;
    await admin
      .from("application_snapshots")
      .update({ application_request_id: siblingAppId })
      .eq("id", siblingSnapshot!.id);

    const { data: residencePayment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: mainAppId,
        residence_id: residenceId,
        student_profile_id: studentProfileId,
        status: "reported_received_by_residence",
        reported_received_by_user_id: ownerId,
        reported_received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    residencePaymentId = residencePayment!.id;

    const { data: reservation } = await admin
      .from("reservations")
      .insert({
        application_request_id: mainAppId,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "pending_estured_fee",
        start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: snapshotId,
        external_residence_payment_id: residencePaymentId,
      })
      .select("id")
      .single();
    reservationId = reservation!.id;
    await admin
      .from("external_residence_payments")
      .update({ reservation_id: reservationId })
      .eq("id", residencePaymentId);

    const { data: feePayment } = await admin
      .from("estured_fee_payments")
      .insert({
        reservation_id: reservationId,
        payer_user_id: studentUserId,
        beneficiary_student_profile_id: studentProfileId,
        status: "paid",
        fee_base_usd: 1900,
        fee_base_ars: 2812000,
        fee_amount_ars: 140500,
        payment_currency: "ARS",
        payment_provider: "manual",
        paid_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    feePaymentId = feePayment!.id;
    await admin.from("reservations").update({ estured_fee_payment_id: feePaymentId }).eq("id", reservationId);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin
      .from("reservations")
      .update({ estured_fee_payment_id: null, booking_receipt_id: null })
      .eq("id", reservationId);
    await admin.from("booking_receipts").delete().eq("reservation_id", reservationId);
    await admin.from("estured_fee_payments").delete().eq("id", feePaymentId);
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", residencePaymentId);
    await admin.from("reservations").delete().eq("id", reservationId);
    await admin.from("external_residence_payments").delete().eq("id", residencePaymentId);
    await admin.from("application_requests").delete().in("id", [mainAppId, siblingAppId]);
    await admin.from("residences").delete().eq("id", residenceId);
  });

  it("confirma la reserva, cierra la solicitud hermana, descuenta disponibilidad y emite comprobante", async () => {
    const result = await confirmReservationAfterFeePaid(admin, {
      feePaymentId,
      actorUserId: null,
      actorRole: "system",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reservationId).toBe(reservationId);
    expect(result.verificationCode).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const { data: reservation } = await admin
      .from("reservations")
      .select("status, booking_receipt_id, confirmed_at")
      .eq("id", reservationId)
      .single();
    expect(reservation!.status).toBe("confirmed");
    expect(reservation!.booking_receipt_id).toBe(result.receiptId);
    expect(reservation!.confirmed_at).not.toBeNull();

    const { data: sibling } = await admin
      .from("application_requests")
      .select("status")
      .eq("id", siblingAppId)
      .single();
    expect(sibling!.status).toBe("closed_due_to_other_confirmed_reservation");

    const { data: availability } = await admin
      .from("profile_availability")
      .select("available_count")
      .eq("room_type_id", roomTypeId)
      .single();
    expect(availability!.available_count).toBe(1); // arrancó en 2

    const { data: receipt } = await admin
      .from("booking_receipts")
      .select("receipt_number, verification_code, status")
      .eq("id", result.receiptId)
      .single();
    expect(receipt!.status).toBe("issued");
    expect(receipt!.receipt_number).toMatch(/^ER-\d{4}-[0-9A-F]{6}$/);
    expect(receipt!.verification_code).toBe(result.verificationCode);

    const { data: fee } = await admin
      .from("estured_fee_payments")
      .select("fiscal_invoice_status")
      .eq("id", feePaymentId)
      .single();
    expect(fee!.fiscal_invoice_status).toBe("pending_issue");
  });
});
