import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reissueBookingReceipt } from "@/lib/receipts/reissueBookingReceipt";

/**
 * Docs/03 §26 (caso de QA: "admin reemite comprobante → auditoría
 * registrada"). Mismo patrón de fixtures que `revokeEsturedFee.test.ts`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("reissueBookingReceipt (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let adminUserId: string;

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

    const { data: adminUser } = await admin
      .from("users")
      .select("id")
      .eq("email", "admin.operaciones@estured.test")
      .single();
    adminUserId = adminUser!.id;

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
        name: "Residencia Test Integración (Ciclo 29 — reemisión de comprobante)",
        slug: `residencia-test-reissue-${Date.now()}`,
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

  async function createConfirmedReservationWithReceipt() {
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
        receipt_payload: { student: { first_name: "Lucia" }, disclaimer: "Test payload" },
      })
      .select("id")
      .single();
    const receiptId = receipt!.id;
    await admin.from("reservations").update({ booking_receipt_id: receiptId }).eq("id", reservationId);

    return { applicationId, residencePaymentId, reservationId, receiptId };
  }

  async function cleanupFixture(
    fixture: { applicationId: string; residencePaymentId: string; reservationId: string; receiptId: string },
    extraReceiptIds: string[] = [],
  ) {
    await admin.from("reservations").update({ booking_receipt_id: null }).eq("id", fixture.reservationId);
    for (const id of extraReceiptIds) await admin.from("booking_receipts").delete().eq("id", id);
    await admin.from("booking_receipts").delete().eq("id", fixture.receiptId);
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", fixture.residencePaymentId);
    await admin.from("reservations").delete().eq("id", fixture.reservationId);
    await admin.from("external_residence_payments").delete().eq("id", fixture.residencePaymentId);
    await admin.from("application_requests").delete().eq("id", fixture.applicationId);
  }

  it("rechaza sin motivo", async () => {
    const fixture = await createConfirmedReservationWithReceipt();
    try {
      const result = await reissueBookingReceipt(admin, {
        receiptId: fixture.receiptId,
        actorUserId: adminUserId,
        actorRole: "admin",
        reason: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/motivo/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("rechaza reemitir un comprobante que no está vigente (ya reemitido)", async () => {
    const fixture = await createConfirmedReservationWithReceipt();
    const extraIds: string[] = [];
    try {
      const first = await reissueBookingReceipt(admin, {
        receiptId: fixture.receiptId,
        actorUserId: adminUserId,
        actorRole: "admin",
        reason: "Primera reemisión de prueba.",
      });
      expect(first.ok).toBe(true);
      if (first.ok) extraIds.push(first.newReceiptId);

      const second = await reissueBookingReceipt(admin, {
        receiptId: fixture.receiptId,
        actorUserId: adminUserId,
        actorRole: "admin",
        reason: "Segunda reemisión de prueba.",
      });
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error).toMatch(/vigente/i);
    } finally {
      await cleanupFixture(fixture, extraIds);
    }
  });

  it("reemite correctamente: nuevo comprobante emitido, el viejo pasa a reissued, la reserva apunta al nuevo", async () => {
    const fixture = await createConfirmedReservationWithReceipt();
    const extraIds: string[] = [];
    try {
      const result = await reissueBookingReceipt(admin, {
        receiptId: fixture.receiptId,
        actorUserId: adminUserId,
        actorRole: "admin",
        reason: "El estudiante pidió corregir un dato.",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      extraIds.push(result.newReceiptId);
      expect(result.newReceiptNumber).toMatch(/^ER-/);

      const { data: oldReceipt } = await admin
        .from("booking_receipts")
        .select("status")
        .eq("id", fixture.receiptId)
        .single();
      expect(oldReceipt!.status).toBe("reissued");

      const { data: newReceipt } = await admin
        .from("booking_receipts")
        .select("status, reissued_from_receipt_id, receipt_payload, verification_code")
        .eq("id", result.newReceiptId)
        .single();
      expect(newReceipt!.status).toBe("issued");
      expect(newReceipt!.reissued_from_receipt_id).toBe(fixture.receiptId);
      expect((newReceipt!.receipt_payload as { student?: { first_name?: string } }).student?.first_name).toBe(
        "Lucia",
      );

      const { data: reservation } = await admin
        .from("reservations")
        .select("booking_receipt_id")
        .eq("id", fixture.reservationId)
        .single();
      expect(reservation!.booking_receipt_id).toBe(result.newReceiptId);
    } finally {
      await cleanupFixture(fixture, extraIds);
    }
  });
});
