import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordNegotiationResponse } from "@/lib/applications/recordNegotiationResponse";

/**
 * Extraída del server action `respondNegotiationProposal` (Ciclo 21,
 * GAPS.md — mismo patrón aplicado a `markResidencePaymentReceived`/
 * `markFeePaidManually` en el Ciclo 20). Cubre el camino de negociación
 * de condiciones, que hasta ahora solo se verificaba a mano en cada e2e.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("recordNegotiationResponse (integración)", () => {
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
        name: "Residencia Test Integración (Ciclo 21 — negociación)",
        slug: `residencia-test-negociacion-${Date.now()}`,
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
    // Red de seguridad: si algún test dejó una solicitud sin limpiar
    // (ej. una aserción falló antes de llegar a la limpieza), borrarla
    // acá para no dejar el `residences.delete()` bloqueado por FK.
    await admin.from("application_requests").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  async function createFixtureApplication() {
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
        status: "offer_pending_student_acceptance",
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

    const { data: proposal } = await admin
      .from("application_negotiation_proposals")
      .insert({
        application_request_id: applicationId,
        sent_by_user_id: ownerId,
        residence_id: residenceId,
        proposed_monthly_price_usd: 280, // ajuste real vs. los 300 originales
        proposed_duration_months: 6,
        special_conditions: "Ingreso una semana después de lo pedido.",
      })
      .select("id")
      .single();

    return { applicationId, snapshotId, proposalId: proposal!.id };
  }

  // `application_snapshots.application_request_id` tiene `on delete
  // cascade` hacia `application_requests` (migración 0007) — borrar la
  // solicitud alcanza y cascadea sus snapshots (original y final). No
  // hace falta ni conviene borrar `application_snapshots` a mano: al
  // revés choca con `application_requests.snapshot_*_id` (sin cascade)
  // y falla en silencio si no se chequea `error`.
  async function deleteFixtureApplication(applicationId: string) {
    await admin.from("external_residence_payments").delete().eq("application_request_id", applicationId);
    await admin.from("application_negotiation_proposals").delete().eq("application_request_id", applicationId);
    const { error } = await admin.from("application_requests").delete().eq("id", applicationId);
    if (error) console.error("[test cleanup] delete application_requests failed:", error);
  }

  it("rechaza si la solicitud no le pertenece al actor", async () => {
    const { applicationId } = await createFixtureApplication();
    try {
      const result = await recordNegotiationResponse(admin, {
        applicationId,
        response: "accepted",
        actorUserId: ownerId, // dueño de residencia, no tiene student_profile
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/no te pertenece/i);
    } finally {
      await deleteFixtureApplication(applicationId);
    }
  });

  it("rechaza si la solicitud no tiene una propuesta pendiente", async () => {
    const { applicationId } = await createFixtureApplication();
    try {
      await admin.from("application_requests").update({ status: "contact_established" }).eq("id", applicationId);

      const result = await recordNegotiationResponse(admin, {
        applicationId,
        response: "accepted",
        actorUserId: studentUserId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/propuesta pendiente/i);
    } finally {
      await deleteFixtureApplication(applicationId);
    }
  });

  it("acepta la propuesta: crea snapshot_final recalculado y habilita el pago a la residencia", async () => {
    const { applicationId } = await createFixtureApplication();
    try {
      const result = await recordNegotiationResponse(admin, {
        applicationId,
        response: "accepted",
        actorUserId: studentUserId,
      });
      expect(result.ok).toBe(true);

      const { data: application } = await admin
        .from("application_requests")
        .select("status, snapshot_final_id")
        .eq("id", applicationId)
        .single();
      expect(application!.status).toBe("residence_payment_pending");
      expect(application!.snapshot_final_id).not.toBeNull();

      const { data: finalSnapshot } = await admin
        .from("application_snapshots")
        .select("snapshot_type, monthly_price_usd, fee_base_usd, estimated_estured_fee_ars")
        .eq("id", application!.snapshot_final_id)
        .single();
      expect(finalSnapshot!.snapshot_type).toBe("final");
      expect(Number(finalSnapshot!.monthly_price_usd)).toBe(280); // el valor propuesto, no el original (300)
      expect(Number(finalSnapshot!.estimated_estured_fee_ars)).toBeGreaterThan(0);

      const { data: proposal } = await admin
        .from("application_negotiation_proposals")
        .select("student_response")
        .eq("application_request_id", applicationId)
        .single();
      expect(proposal!.student_response).toBe("accepted");

      const { data: residencePayment } = await admin
        .from("external_residence_payments")
        .select("status")
        .eq("application_request_id", applicationId)
        .single();
      expect(residencePayment!.status).toBe("pending");
    } finally {
      await deleteFixtureApplication(applicationId);
    }
  });

  it("rechaza y cierra la solicitud (rejected_closed) sin habilitar pago a la residencia", async () => {
    const { applicationId } = await createFixtureApplication();
    try {
      const result = await recordNegotiationResponse(admin, {
        applicationId,
        response: "rejected_closed",
        actorUserId: studentUserId,
      });
      expect(result.ok).toBe(true);

      const { data: application } = await admin
        .from("application_requests")
        .select("status")
        .eq("id", applicationId)
        .single();
      expect(application!.status).toBe("cancelled_by_student");

      const { data: residencePayment } = await admin
        .from("external_residence_payments")
        .select("id")
        .eq("application_request_id", applicationId)
        .maybeSingle();
      expect(residencePayment).toBeNull();
    } finally {
      await deleteFixtureApplication(applicationId);
    }
  });
});
