import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expireEsturedFeeWindows } from "@/lib/jobs/expireEsturedFeeWindows";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireEsturedFeeWindows (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let mainAppId: string;
  let residencePaymentId: string;
  let reservationId: string;
  let staleFeeId: string;

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
        name: "Residencia Test Integración (Ciclo 22 — expire fee windows)",
        slug: `residencia-test-expire-fee-${Date.now()}`,
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
    const snapshotId = snapshot!.id;

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
    await admin.from("external_residence_payments").update({ reservation_id: reservationId }).eq("id", residencePaymentId);

    const { data: feePayment } = await admin
      .from("estured_fee_payments")
      .insert({
        reservation_id: reservationId,
        payer_user_id: studentUserId,
        beneficiary_student_profile_id: studentProfileId,
        status: "pending_payment_method",
        fee_base_usd: 1900,
        fee_base_ars: 2812000,
        fee_amount_ars: 140500,
        expires_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), // venció hace 3h
      })
      .select("id")
      .single();
    staleFeeId = feePayment!.id;
    await admin.from("reservations").update({ estured_fee_payment_id: staleFeeId }).eq("id", reservationId);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("reservations").update({ estured_fee_payment_id: null }).eq("id", reservationId);
    await admin.from("estured_fee_payments").delete().eq("id", staleFeeId);
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", residencePaymentId);
    await admin.from("reservations").delete().eq("id", reservationId);
    await admin.from("external_residence_payments").delete().eq("id", residencePaymentId);
    await admin.from("application_requests").delete().eq("id", mainAppId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("vence el fee pendiente y pasa la reserva a expired_fee_unpaid", async () => {
    const result = await expireEsturedFeeWindows(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const { data: fee } = await admin.from("estured_fee_payments").select("status").eq("id", staleFeeId).single();
    expect(fee!.status).toBe("expired");

    const { data: reservation } = await admin.from("reservations").select("status").eq("id", reservationId).single();
    expect(reservation!.status).toBe("expired_fee_unpaid");
  });
});
