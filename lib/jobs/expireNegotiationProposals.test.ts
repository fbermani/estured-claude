import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";
import { expireNegotiationProposals } from "@/lib/jobs/expireNegotiationProposals";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireNegotiationProposals (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  // Estudiante descartable: el del seed puede tener ya una solicitud activa (tope de 2, 0093).
  let student: TestStudent;
  let staleAppId: string;
  let freshAppId: string;

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

    student = await createTestStudent(admin, "expire-negotiation");

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 22 — expire negotiation)",
        slug: `residencia-test-expire-negotiation-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
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
      })
      .select("id")
      .single();
    roomTypeId = roomType!.id;

    async function createApp(negotiationExpiry: string) {
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

      const { data: application, error } = await admin
        .from("application_requests")
        .insert({
          student_profile_id: student.profileId,
          initiated_by: "student",
          contact_target: "student",
          residence_id: residenceId,
          room_type_id: roomTypeId,
          status: "offer_pending_student_acceptance",
          desired_start_date: "2026-08-15",
          initial_duration_months: 6,
          academic_objective: "Objetivo académico de prueba (test de integración).",
          snapshot_original_id: snapshot!.id,
          created_by_user_id: student.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(`fixture: ${error.message}`);
      await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshot!.id);

      await admin.from("application_negotiation_proposals").insert({
        application_request_id: application!.id,
        sent_by_user_id: ownerId,
        residence_id: residenceId,
        proposed_monthly_price_usd: 280,
        expires_at: negotiationExpiry,
      });

      return application!.id;
    }

    staleAppId = await createApp(new Date(Date.now() - 3 * 3_600_000).toISOString());
    freshAppId = await createApp(new Date(Date.now() + 48 * 3_600_000).toISOString());
  });

  afterAll(async () => {
    if (!admin) return;
    const appIds = [staleAppId, freshAppId].filter(Boolean);
    if (appIds.length > 0) {
      await admin.from("application_negotiation_proposals").delete().in("application_request_id", appIds);
      await admin.from("application_requests").delete().in("id", appIds);
    }
    if (residenceId) await deleteResidenceCascade(admin, residenceId);
    await deleteTestStudent(admin, student);
  });

  it("vence solo las solicitudes con propuesta de ajuste sin responder y ya vencida", async () => {
    const result = await expireNegotiationProposals(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const { data: stale } = await admin.from("application_requests").select("status").eq("id", staleAppId).single();
    expect(stale!.status).toBe("expired_offer_no_response");

    const { data: statusEvent } = await admin
      .from("application_status_events")
      .select("to_status, changed_by_role")
      .eq("application_request_id", staleAppId)
      .eq("to_status", "expired_offer_no_response")
      .maybeSingle();
    expect(statusEvent).not.toBeNull();
    expect(statusEvent!.changed_by_role).toBe("system");

    const { data: fresh } = await admin.from("application_requests").select("status").eq("id", freshAppId).single();
    expect(fresh!.status).toBe("offer_pending_student_acceptance");
  });
});
