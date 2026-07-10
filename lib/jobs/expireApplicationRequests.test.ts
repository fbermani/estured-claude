import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireApplicationRequests (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let staleSubmittedId: string;
  let staleResidencePaymentId: string;
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
        name: "Residencia Test Integración (Ciclo 22 — expire application requests)",
        slug: `residencia-test-expire-apps-${Date.now()}`,
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

    async function createSnapshot() {
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
      return snapshot!.id;
    }

    async function createApp(status: string, extra: Record<string, unknown>) {
      const snapshotId = await createSnapshot();
      const { data: application } = await admin
        .from("application_requests")
        .insert({
          student_profile_id: studentProfileId,
          initiated_by: "student",
          contact_target: "student",
          residence_id: residenceId,
          room_type_id: roomTypeId,
          status,
          desired_start_date: "2026-08-15",
          initial_duration_months: 6,
          academic_objective: "Objetivo académico de prueba (test de integración).",
          snapshot_original_id: snapshotId,
          created_by_user_id: studentUserId,
          ...extra,
        })
        .select("id")
        .single();
      await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshotId);
      return application!.id;
    }

    staleSubmittedId = await createApp("submitted", {
      expires_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    });
    staleResidencePaymentId = await createApp("residence_payment_pending", {
      payment_deadline_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    });
    freshAppId = await createApp("submitted", {
      expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("application_requests").delete().in("id", [staleSubmittedId, staleResidencePaymentId, freshAppId]);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("vence solicitudes sin respuesta de la residencia y sin pago a la residencia, deja intacta la vigente", async () => {
    const result = await expireApplicationRequests(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(2);

    const { data: staleSubmitted } = await admin
      .from("application_requests")
      .select("status")
      .eq("id", staleSubmittedId)
      .single();
    expect(staleSubmitted!.status).toBe("expired_no_residence_response");

    const { data: staleResidencePayment } = await admin
      .from("application_requests")
      .select("status")
      .eq("id", staleResidencePaymentId)
      .single();
    expect(staleResidencePayment!.status).toBe("expired_no_student_payment");

    const { data: fresh } = await admin.from("application_requests").select("status").eq("id", freshAppId).single();
    expect(fresh!.status).toBe("submitted");
  });
});
