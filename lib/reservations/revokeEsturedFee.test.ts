import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { revokeEsturedFee } from "@/lib/reservations/revokeEsturedFee";

/**
 * Docs/07 §18.6, docs/08 §6.9bis, docs/10 §15.4 (DECISIÓN CONFIRMADA) —
 * derecho de revocación del fee dentro de los 10 días corridos desde
 * el pago. Mismo patrón de fixtures que `confirmAfterFeePaid.test.ts`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("revokeEsturedFee (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;

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
        name: "Residencia Test Integración (Ciclo 23 — revocación del fee)",
        slug: `residencia-test-revocation-${Date.now()}`,
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
  });

  afterAll(async () => {
    if (!admin) return;
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  async function createConfirmedReservationWithFee(paidAt: string) {
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

    const { data: application } = await admin
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
    const applicationId = application!.id;
    await admin.from("application_snapshots").update({ application_request_id: applicationId }).eq("id", snapshotId);

    const { data: residencePayment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: applicationId,
        residence_id: residenceId,
        student_profile_id: studentProfileId,
        status: "reported_received_by_residence",
        reported_received_by_user_id: ownerId,
        reported_received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const residencePaymentId = residencePayment!.id;

    const { data: reservation } = await admin
      .from("reservations")
      .insert({
        application_request_id: applicationId,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: snapshotId,
        external_residence_payment_id: residencePaymentId,
      })
      .select("id")
      .single();
    const reservationId = reservation!.id;
    await admin.from("external_residence_payments").update({ reservation_id: reservationId }).eq("id", residencePaymentId);

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
        paid_at: paidAt,
        expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    const feePaymentId = feePayment!.id;
    await admin.from("reservations").update({ estured_fee_payment_id: feePaymentId }).eq("id", reservationId);

    const { data: receipt } = await admin
      .from("booking_receipts")
      .insert({
        reservation_id: reservationId,
        student_profile_id: studentProfileId,
        payer_user_id: studentUserId,
        residence_id: residenceId,
        status: "issued",
        receipt_number: `ER-TEST-${Date.now()}`,
        verification_code: crypto.randomUUID(),
        qr_code_value: `http://localhost:3000/verify/${crypto.randomUUID()}`,
        issued_at: new Date().toISOString(),
        receipt_payload: {},
      })
      .select("id")
      .single();
    const receiptId = receipt!.id;
    await admin.from("reservations").update({ booking_receipt_id: receiptId }).eq("id", reservationId);

    return { applicationId, residencePaymentId, reservationId, feePaymentId, receiptId };
  }

  async function cleanupFixture(fixture: {
    applicationId: string;
    residencePaymentId: string;
    reservationId: string;
    feePaymentId: string;
    receiptId: string;
  }) {
    await admin
      .from("reservations")
      .update({ estured_fee_payment_id: null, booking_receipt_id: null })
      .eq("id", fixture.reservationId);
    await admin.from("booking_receipts").delete().eq("id", fixture.receiptId);
    await admin.from("estured_fee_payments").delete().eq("id", fixture.feePaymentId);
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", fixture.residencePaymentId);
    await admin.from("reservations").delete().eq("id", fixture.reservationId);
    await admin.from("external_residence_payments").delete().eq("id", fixture.residencePaymentId);
    await admin.from("application_requests").delete().eq("id", fixture.applicationId);
  }

  it("rechaza sin acknowledge_no_automatic_refund", async () => {
    const fixture = await createConfirmedReservationWithFee(new Date().toISOString());
    try {
      const result = await revokeEsturedFee(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        reason: null,
        acknowledgeNoAutomaticRefund: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/reembolso automático/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rechaza si el actor no es ni dueño ni pagador del fee", async () => {
    const fixture = await createConfirmedReservationWithFee(new Date().toISOString());
    try {
      const result = await revokeEsturedFee(admin, {
        reservationId: fixture.reservationId,
        actorUserId: ownerId, // dueño de la residencia, no de la reserva
        reason: null,
        acknowledgeNoAutomaticRefund: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no te pertenece/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rechaza fuera del plazo de 10 días corridos", async () => {
    const fixture = await createConfirmedReservationWithFee(
      new Date(Date.now() - 11 * 24 * 3_600_000).toISOString(),
    );
    try {
      const result = await revokeEsturedFee(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        reason: null,
        acknowledgeNoAutomaticRefund: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/plazo de 10 días/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("revoca dentro de plazo: cancela la reserva, anula el comprobante, el fee sigue paid", async () => {
    const fixture = await createConfirmedReservationWithFee(new Date(Date.now() - 2 * 24 * 3_600_000).toISOString());
    try {
      const result = await revokeEsturedFee(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        reason: "Cambié de planes.",
        acknowledgeNoAutomaticRefund: true,
      });
      expect(result.ok).toBe(true);

      const { data: reservation } = await admin
        .from("reservations")
        .select("status, cancellation_reason_code, cancelled_at")
        .eq("id", fixture.reservationId)
        .single();
      expect(reservation!.status).toBe("cancelled_by_student");
      expect(reservation!.cancellation_reason_code).toBe("student_revocation_right");
      expect(reservation!.cancelled_at).not.toBeNull();

      const { data: receipt } = await admin
        .from("booking_receipts")
        .select("status, voided_at")
        .eq("id", fixture.receiptId)
        .single();
      expect(receipt!.status).toBe("voided");
      expect(receipt!.voided_at).not.toBeNull();

      const { data: feePayment } = await admin
        .from("estured_fee_payments")
        .select("status")
        .eq("id", fixture.feePaymentId)
        .single();
      expect(feePayment!.status).toBe("paid"); // nunca pasa a refunded automáticamente
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
