import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { resolveFeeRevocation } from "@/lib/revocations/resolveFeeRevocation";
import { revokeEsturedFee } from "@/lib/reservations/revokeEsturedFee";

/**
 * Ciclo 68 (DR6) — integración de "Resolver revocación" contra estured-dev. Corre SOLO con la migración 0049 aplicada:
 *   MIGRATION_0049_APPLIED=1 npx vitest run lib/revocations/resolveFeeRevocationIntegration
 * Crea su propia residencia/reserva/fee de prueba (no toca los datos demo) y la borra al terminar.
 */
const enabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.MIGRATION_0049_APPLIED === "1",
);

describe.skipIf(!enabled)("resolveFeeRevocation (integración, requiere 0049)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let adminUserId: string;
  const created: { reservationId: string; feeId: string; applicationId: string; residencePaymentId: string; receiptId: string }[] = [];

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    ownerId = (await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single()).data!.id;
    studentUserId = (await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single()).data!.id;
    studentProfileId = (await admin.from("student_profiles").select("id").eq("user_id", studentUserId).single()).data!.id;
    const adminRow = await admin.from("user_roles").select("user_id").in("role", ["admin", "superadmin"]).limit(1).single();
    adminUserId = adminRow.data!.user_id;

    residenceId = (
      await admin
        .from("residences")
        .insert({
          name: "Residencia Test Integración (Ciclo 68 — resolver revocación)",
          slug: `residencia-test-resolver-revocacion-${Date.now()}`,
          property_type: "residencia_estudiantil",
          status: "verified_active",
          operating_mode: "verified_profile",
          public_area: "Palermo",
          total_capacity: 5,
          created_by: ownerId,
        })
        .select("id")
        .single()
    ).data!.id;
    roomTypeId = (
      await admin.from("room_types").insert({ residence_id: residenceId, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 }).select("id").single()
    ).data!.id;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    for (const f of created) {
      await admin.from("support_cases").delete().eq("related_entity_id", f.reservationId);
      await admin.from("notifications").delete().eq("related_entity_id", f.reservationId);
      await admin.from("reservations").update({ estured_fee_payment_id: null, booking_receipt_id: null }).eq("id", f.reservationId);
      await admin.from("booking_receipts").delete().eq("id", f.receiptId);
      await admin.from("estured_fee_payments").delete().eq("id", f.feeId);
      await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", f.residencePaymentId);
      await admin.from("reservations").delete().eq("id", f.reservationId);
      await admin.from("external_residence_payments").delete().eq("id", f.residencePaymentId);
      await admin.from("application_requests").delete().eq("id", f.applicationId);
    }
    await deleteResidenceCascade(admin, residenceId);
  });

  /** Reserva confirmada con fee pagado hace `paidDaysAgo` días y revocada por el estudiante (vía `revokeEsturedFee`). */
  async function revokedReservation(paidDaysAgo: number) {
    const paidAt = new Date(Date.now() - paidDaysAgo * 24 * 3_600_000).toISOString();
    const snapshotId = (
      await admin
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
        .single()
    ).data!.id;
    const applicationId = (
      await admin
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
        .single()
    ).data!.id;
    await admin.from("application_snapshots").update({ application_request_id: applicationId }).eq("id", snapshotId);
    const residencePaymentId = (
      await admin
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
        .single()
    ).data!.id;
    const reservationId = (
      await admin
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
        .single()
    ).data!.id;
    await admin.from("external_residence_payments").update({ reservation_id: reservationId }).eq("id", residencePaymentId);
    const feeId = (
      await admin
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
        .single()
    ).data!.id;
    await admin.from("reservations").update({ estured_fee_payment_id: feeId }).eq("id", reservationId);
    const receiptId = (
      await admin
        .from("booking_receipts")
        .insert({
          reservation_id: reservationId,
          student_profile_id: studentProfileId,
          payer_user_id: studentUserId,
          residence_id: residenceId,
          status: "issued",
          receipt_number: `ER-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          verification_code: crypto.randomUUID(),
          qr_code_value: `http://localhost:3000/verify/${crypto.randomUUID()}`,
          issued_at: new Date().toISOString(),
          receipt_payload: {},
        })
        .select("id")
        .single()
    ).data!.id;
    await admin.from("reservations").update({ booking_receipt_id: receiptId }).eq("id", reservationId);
    created.push({ reservationId, feeId, applicationId, residencePaymentId, receiptId });

    const revoked = await revokeEsturedFee(admin, {
      reservationId,
      actorUserId: studentUserId,
      reason: "Conseguí otro lugar.",
      acknowledgeUnderstanding: true,
    });
    expect(revoked).toEqual({ ok: true });
    return { reservationId, feeId };
  }

  const refundInput = {
    decision: "refunded",
    internalReason: "Dentro de plazo, sin indicios de bypass.",
    studentMessage: "Te transferimos el fee completo.",
    confirmRefundAmountArs: 140500,
    refundMethod: "bank_transfer",
    refundReference: "OP-TEST-1",
    refundedOn: new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }),
    justifiedCause: false,
    confirmDenial: false,
  };

  it("revocar abre un caso de Soporte fee_revocation sin residencia", async () => {
    const { reservationId } = await revokedReservation(1);
    const { data: cases } = await admin.from("support_cases").select("topic, residence_id, status").eq("related_entity_id", reservationId);
    expect(cases).toEqual([{ topic: "fee_revocation", residence_id: null, status: "opened" }]);
  });

  it("reintegrar deja el fee refunded con la resolución, cierra el caso y no se puede resolver dos veces", async () => {
    const { reservationId, feeId } = await revokedReservation(2);
    const first = await resolveFeeRevocation(admin, { reservationId, actorUserId: adminUserId, actorRole: "admin", input: refundInput });
    expect(first).toEqual({ ok: true, decision: "refunded" });

    const { data: fee } = await admin
      .from("estured_fee_payments")
      .select("status, revocation_resolution, revocation_internal_reason, revocation_student_message, refund_amount_ars, refund_method, refund_reference, refunded_at, revocation_resolved_by")
      .eq("id", feeId)
      .single();
    expect(fee).toMatchObject({
      status: "refunded",
      revocation_resolution: "refunded",
      revocation_internal_reason: refundInput.internalReason,
      revocation_student_message: refundInput.studentMessage,
      refund_method: "bank_transfer",
      refund_reference: "OP-TEST-1",
      revocation_resolved_by: adminUserId,
    });
    expect(Number(fee!.refund_amount_ars)).toBe(140500);

    const { data: cases } = await admin.from("support_cases").select("status, resolution_outcome").eq("related_entity_id", reservationId);
    expect(cases).toEqual([{ status: "admin_action_taken", resolution_outcome: "estured_fee_refund" }]);

    const second = await resolveFeeRevocation(admin, { reservationId, actorUserId: adminUserId, actorRole: "admin", input: refundInput });
    expect(second.ok).toBe(false);
  });

  it("dos resoluciones simultáneas: solo una gana (update condicional)", async () => {
    const { reservationId } = await revokedReservation(2);
    const attempt = () => resolveFeeRevocation(admin, { reservationId, actorUserId: adminUserId, actorRole: "admin", input: refundInput });
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("denegar dentro de los 10 días exige causa justificada; con ella deja el fee paid y la reserva cancelada", async () => {
    const { reservationId, feeId } = await revokedReservation(3);
    const denyBase = { ...refundInput, decision: "denied", confirmDenial: true, internalReason: "Usó el contacto para acordar por fuera." };
    const rejected = await resolveFeeRevocation(admin, { reservationId, actorUserId: adminUserId, actorRole: "admin", input: { ...denyBase, justifiedCause: false } });
    expect(rejected).toMatchObject({ ok: false, error: expect.stringMatching(/causa justificada/i) });

    const accepted = await resolveFeeRevocation(admin, { reservationId, actorUserId: adminUserId, actorRole: "admin", input: { ...denyBase, justifiedCause: true } });
    expect(accepted).toEqual({ ok: true, decision: "denied" });
    const { data: fee } = await admin.from("estured_fee_payments").select("status, revocation_resolution, refund_amount_ars").eq("id", feeId).single();
    expect(fee).toMatchObject({ status: "paid", revocation_resolution: "denied", refund_amount_ars: null });
    const { data: reservation } = await admin.from("reservations").select("status").eq("id", reservationId).single();
    expect(reservation!.status).toBe("cancelled_by_student");
  });

  it("la base rechaza una resolución con forma inválida (CHECK de coherencia)", async () => {
    const { feeId } = await revokedReservation(1);
    const { error } = await admin.from("estured_fee_payments").update({ revocation_resolution: "refunded" }).eq("id", feeId);
    expect(error).not.toBeNull();
  });
});
