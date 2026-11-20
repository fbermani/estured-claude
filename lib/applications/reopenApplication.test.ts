import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { reopenApplication } from "@/lib/applications/reopenApplication";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";

/**
 * Docs/12 §17 Fase 11 ("Admin puede intervenir solicitudes trabadas") —
 * Ciclo 34septies. Mismo patrón de fixtures que roomTypeQueue.test.ts:
 * inserta application_requests directo (bypass de la creación real) para
 * poder controlar el estado inicial exacto.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("reopenApplication (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let adminActorId: string;
  let studentProfileId: string;
  let studentUserId: string;
  let testStudent: TestStudent | undefined;

  async function insertFixtureApplication(status: string): Promise<string> {
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
        snapshot_original_id: snapshot!.id,
        created_by_user_id: studentUserId,
      })
      .select("id")
      .single();
    await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshot!.id);
    return application!.id;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = adminUser!.id;
    // Estudiante descartable propio: el test no depende de las solicitudes activas del demo (límite de 2).
    testStudent = await createTestStudent(admin, "reopen");
    studentUserId = testStudent.userId;
    studentProfileId = testStudent.profileId;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 34septies — reabrir solicitud)",
        slug: `residencia-test-reopen-${Date.now()}`,
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

    const { error: residenceUsersError } = await admin
      .from("residence_users")
      .insert({ residence_id: residenceId, user_id: ownerId, role: "owner", is_active: true });
    if (residenceUsersError) {
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(`No se pudo dar acceso al owner demo (¿límite de 10 residencias?): ${residenceUsersError.message}`);
    }

    const { data: roomType } = await admin
      .from("room_types")
      .insert({
        residence_id: residenceId,
        name: "Individual",
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        is_active: true,
      })
      .select("id")
      .single();
    roomTypeId = roomType!.id;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin.from("notifications").delete().eq("user_id", studentUserId).eq("related_entity_type", "application_requests");
    await admin.from("application_snapshots").delete().eq("room_type_id", roomTypeId);
    await admin.from("application_requests").delete().eq("residence_id", residenceId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    await deleteResidenceCascade(admin, residenceId);
    await deleteTestStudent(admin, testStudent);
  });

  it("rechaza sin motivo", async () => {
    const id = await insertFixtureApplication("rejected");
    const result = await reopenApplication(admin, { applicationId: id, actorUserId: adminActorId, actorRole: "admin", reason: "hi" });
    expect(result.status).toBe("error");
  });

  it("rechaza un estado que no es reabrible", async () => {
    const id = await insertFixtureApplication("under_review");
    const result = await reopenApplication(admin, {
      applicationId: id,
      actorUserId: adminActorId,
      actorRole: "admin",
      reason: "Motivo de prueba de reapertura.",
    });
    expect(result.status).toBe("error");
  });

  it("reabre una solicitud rechazada, registra el evento y notifica al estudiante", async () => {
    const id = await insertFixtureApplication("rejected");
    const result = await reopenApplication(admin, {
      applicationId: id,
      actorUserId: adminActorId,
      actorRole: "admin",
      reason: "La residencia confirmó que fue un error operativo.",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.newStatus).toBe("submitted");

    const { data: application } = await admin.from("application_requests").select("status").eq("id", id).single();
    expect(application?.status).toBe("submitted");

    const { data: event } = await admin
      .from("application_status_events")
      .select("from_status, to_status, changed_by_role")
      .eq("application_request_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(event?.from_status).toBe("rejected");
    expect(event?.to_status).toBe("submitted");
    expect(event?.changed_by_role).toBe("admin");

    const { data: notification } = await admin
      .from("notifications")
      .select("title")
      .eq("user_id", studentUserId)
      .eq("related_entity_id", id)
      .maybeSingle();
    expect(notification?.title).toBe("Tu solicitud fue reabierta");
  });

  it("rechaza un motivo que supera el tope", async () => {
    const id = await insertFixtureApplication("rejected");
    const result = await reopenApplication(admin, {
      applicationId: id,
      actorUserId: adminActorId,
      actorRole: "admin",
      reason: "a".repeat(501),
    });
    expect(result.status).toBe("error");
  });

  it("dos reaperturas simultáneas: una gana y no se duplican eventos", async () => {
    // El máximo de 2 activas cuenta las reabiertas por tests previos: se las deja inactivas antes de competir.
    await admin
      .from("application_requests")
      .update({ status: "rejected" })
      .eq("student_profile_id", studentProfileId)
      .in("status", ["submitted", "under_review"]);
    const id = await insertFixtureApplication("rejected");
    const params = {
      applicationId: id,
      actorUserId: adminActorId,
      actorRole: "admin",
      reason: "Reapertura concurrente de prueba.",
    };
    const results = await Promise.all([reopenApplication(admin, params), reopenApplication(admin, params)]);
    expect(results.filter((r) => r.status === "ok"), JSON.stringify(results)).toHaveLength(1);

    const { count } = await admin
      .from("application_status_events")
      .select("*", { count: "exact", head: true })
      .eq("application_request_id", id)
      .eq("from_status", "rejected");
    expect(count).toBe(1);
  });
});
