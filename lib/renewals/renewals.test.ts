import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRenewalRequest } from "@/lib/renewals/createRenewalRequest";
import { createRenewalOffer } from "@/lib/renewals/createRenewalOffer";
import { sendRenewalOffer } from "@/lib/renewals/sendRenewalOffer";
import { respondRenewalOffer } from "@/lib/renewals/respondRenewalOffer";

/**
 * Docs/12 §13 (módulo de Renovaciones, fase 1: solicitud → oferta →
 * aceptar/rechazar). Mismo patrón de fixtures que
 * `revokeEsturedFee.test.ts` (crea una reserva `confirmed` real).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("módulo de renovaciones (integración)", () => {
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
        name: "Residencia Test Integración (Ciclo 30 — renovaciones)",
        slug: `residencia-test-renewals-${Date.now()}`,
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

    // assertResidenceAccess (lib/residences/access.ts) valida residence_users,
    // no alcanza con `created_by` en la residencia — sin esto,
    // createRenewalOffer rechaza con "No tenés acceso a esta residencia."
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
  });

  afterAll(async () => {
    if (!admin) return;
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  async function createConfirmedReservation() {
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
    await admin
      .from("external_residence_payments")
      .update({ reservation_id: reservationId })
      .eq("id", residencePaymentId);

    return { applicationId, residencePaymentId, reservationId };
  }

  async function cleanupFixture(
    fixture: { applicationId: string; residencePaymentId: string; reservationId: string },
    extra: { renewalOfferIds?: string[]; renewalRequestIds?: string[] } = {},
  ) {
    for (const id of extra.renewalOfferIds ?? []) {
      await admin.from("renewal_offers").delete().eq("id", id);
    }
    for (const id of extra.renewalRequestIds ?? []) {
      await admin.from("renewal_requests").delete().eq("id", id);
    }
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", fixture.residencePaymentId);
    await admin.from("reservations").delete().eq("id", fixture.reservationId);
    await admin.from("external_residence_payments").delete().eq("id", fixture.residencePaymentId);
    await admin.from("application_requests").delete().eq("id", fixture.applicationId);
  }

  it("createRenewalRequest: el estudiante dueño puede solicitar renovación de su reserva confirmada", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const result = await createRenewalRequest(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        message: "Me gustaría quedarme un año más.",
        desiredDurationMonths: 12,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { data: request } = await admin
        .from("renewal_requests")
        .select("status, message, desired_duration_months")
        .eq("id", result.renewalRequestId)
        .single();
      expect(request!.status).toBe("created_by_student");
      expect(request!.message).toBe("Me gustaría quedarme un año más.");
      expect(request!.desired_duration_months).toBe(12);

      await cleanupFixture(fixture, { renewalRequestIds: [result.renewalRequestId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("createRenewalRequest: rechaza si el actor no es el dueño de la reserva", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const result = await createRenewalRequest(admin, {
        reservationId: fixture.reservationId,
        actorUserId: ownerId,
        message: null,
        desiredDurationMonths: null,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no te pertenece/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("createRenewalRequest: rechaza una segunda solicitud mientras hay una en curso", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const first = await createRenewalRequest(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        message: null,
        desiredDurationMonths: null,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = await createRenewalRequest(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        message: null,
        desiredDurationMonths: null,
      });
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error).toMatch(/en curso/i);

      await cleanupFixture(fixture, { renewalRequestIds: [first.renewalRequestId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("createRenewalOffer: la residencia crea una oferta (borrador) y calcula fee/ARS correctamente", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const acceptanceDeadlineAt = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
      const result = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: null,
        actorUserId: ownerId,
        periodStartDate: "2027-08-15",
        durationMonths: 12,
        monthlyPriceUsd: 320,
        enrollmentOrRenewalFeeUsd: 100,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt,
        sendNow: false,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { data: offer } = await admin
        .from("renewal_offers")
        .select("status, monthly_price_ars, fee_base_usd, estimated_estured_fee_ars, period_end_date")
        .eq("id", result.renewalOfferId)
        .single();
      expect(offer!.status).toBe("draft");
      expect(Number(offer!.monthly_price_ars)).toBeGreaterThan(0);
      // fee_base_usd = 320*12 + 100 = 3940
      expect(Number(offer!.fee_base_usd)).toBe(3940);
      // estimated fee = 5% del fee_base en ARS
      expect(Number(offer!.estimated_estured_fee_ars)).toBeGreaterThan(0);
      expect(offer!.period_end_date).toBe("2028-08-15");

      await cleanupFixture(fixture, { renewalOfferIds: [result.renewalOfferId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("createRenewalOffer: rechaza si el actor no tiene acceso a la residencia", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const result = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: null,
        actorUserId: studentUserId, // no es owner/staff de la residencia
        periodStartDate: "2027-08-15",
        durationMonths: 12,
        monthlyPriceUsd: 320,
        enrollmentOrRenewalFeeUsd: null,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
        sendNow: false,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no tenés acceso/i);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("sendRenewalOffer + respondRenewalOffer: flujo completo enviar → aceptar", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const created = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: null,
        actorUserId: ownerId,
        periodStartDate: "2027-08-15",
        durationMonths: 6,
        monthlyPriceUsd: 300,
        enrollmentOrRenewalFeeUsd: null,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
        sendNow: false,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const sent = await sendRenewalOffer(admin, { renewalOfferId: created.renewalOfferId, actorUserId: ownerId });
      expect(sent.ok).toBe(true);

      const { data: afterSend } = await admin
        .from("renewal_offers")
        .select("status, sent_by_user_id")
        .eq("id", created.renewalOfferId)
        .single();
      expect(afterSend!.status).toBe("sent");
      expect(afterSend!.sent_by_user_id).toBe(ownerId);

      const accepted = await respondRenewalOffer(admin, {
        renewalOfferId: created.renewalOfferId,
        response: "accepted",
        actorUserId: studentUserId,
      });
      expect(accepted.ok).toBe(true);

      const { data: afterAccept } = await admin
        .from("renewal_offers")
        .select("status, accepted_at")
        .eq("id", created.renewalOfferId)
        .single();
      expect(afterAccept!.status).toBe("accepted_by_student");
      expect(afterAccept!.accepted_at).not.toBeNull();

      await cleanupFixture(fixture, { renewalOfferIds: [created.renewalOfferId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("respondRenewalOffer: rechaza si el actor no es el estudiante dueño de la oferta", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const created = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: null,
        actorUserId: ownerId,
        periodStartDate: "2027-08-15",
        durationMonths: 6,
        monthlyPriceUsd: 300,
        enrollmentOrRenewalFeeUsd: null,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
        sendNow: true,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await respondRenewalOffer(admin, {
        renewalOfferId: created.renewalOfferId,
        response: "accepted",
        actorUserId: ownerId, // no es el estudiante
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no te pertenece/i);

      await cleanupFixture(fixture, { renewalOfferIds: [created.renewalOfferId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("respondRenewalOffer: rechaza si el plazo ya venció", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const created = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: null,
        actorUserId: ownerId,
        periodStartDate: "2027-08-15",
        durationMonths: 6,
        monthlyPriceUsd: 300,
        enrollmentOrRenewalFeeUsd: null,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt: new Date(Date.now() + 60_000).toISOString(),
        sendNow: true,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Forzamos el vencimiento directamente (no hay job de vencimiento todavía).
      await admin
        .from("renewal_offers")
        .update({ acceptance_deadline_at: new Date(Date.now() - 60_000).toISOString() })
        .eq("id", created.renewalOfferId);

      const result = await respondRenewalOffer(admin, {
        renewalOfferId: created.renewalOfferId,
        response: "accepted",
        actorUserId: studentUserId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/venció/i);

      await cleanupFixture(fixture, { renewalOfferIds: [created.renewalOfferId] });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });

  it("createRenewalOffer con renewalRequestId: marca la solicitud como offer_received al enviar", async () => {
    const fixture = await createConfirmedReservation();
    try {
      const request = await createRenewalRequest(admin, {
        reservationId: fixture.reservationId,
        actorUserId: studentUserId,
        message: null,
        desiredDurationMonths: null,
      });
      expect(request.ok).toBe(true);
      if (!request.ok) return;

      const offer = await createRenewalOffer(admin, {
        reservationId: fixture.reservationId,
        renewalRequestId: request.renewalRequestId,
        actorUserId: ownerId,
        periodStartDate: "2027-08-15",
        durationMonths: 6,
        monthlyPriceUsd: 300,
        enrollmentOrRenewalFeeUsd: null,
        depositUsd: null,
        adjustmentPolicy: "quarterly",
        acceptanceDeadlineAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
        sendNow: true,
      });
      expect(offer.ok).toBe(true);
      if (!offer.ok) return;

      const { data: requestAfter } = await admin
        .from("renewal_requests")
        .select("status")
        .eq("id", request.renewalRequestId)
        .single();
      expect(requestAfter!.status).toBe("offer_received");

      await cleanupFixture(fixture, {
        renewalOfferIds: [offer.renewalOfferId],
        renewalRequestIds: [request.renewalRequestId],
      });
    } catch (e) {
      await cleanupFixture(fixture);
      throw e;
    }
  });
});
