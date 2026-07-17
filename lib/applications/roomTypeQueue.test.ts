import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  determineInitialApplicationStatus,
  promoteNextQueuedApplication,
  MAX_VISIBLE_PER_ROOM_TYPE,
  MAX_QUEUED_PER_ROOM_TYPE,
} from "@/lib/applications/roomTypeQueue";

/**
 * Docs/03 §10.3-10.4 — cola por tipo de habitación en Modo Perfil
 * Verificado (Ciclo 33, Fase 5.2 acotada — ver MEMORY.md). Los fixtures
 * insertan `application_requests` directo (bypass de la lógica de
 * negocio real) porque acá lo que se prueba es el conteo de visibles/en
 * cola en sí, no el flujo completo de creación de solicitud (ya cubierto
 * por otros tests). Reusa a Lucía como `student_profile_id` en todos los
 * fixtures — el límite de 2 solicitudes activas por estudiante no se
 * enforcea a nivel de base, solo en la capa de negocio que no se llama acá.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("roomTypeQueue (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentProfileId: string;
  let createdByUserId: string;
  const applicationIds: string[] = [];

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
    createdByUserId = studentUser!.id;

    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", createdByUserId)
      .single();
    studentProfileId = studentProfile!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 33 — cola por tipo)",
        slug: `residencia-test-cola-tipo-${Date.now()}`,
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

    const { error: residenceUsersError } = await admin.from("residence_users").insert({
      residence_id: residenceId,
      user_id: ownerId,
      role: "owner",
      is_active: true,
    });
    if (residenceUsersError) {
      // Mismo fix que en renewals.test.ts / recordResidencePaymentReceived.test.ts
      // / waitlist.test.ts (gotcha #35): Vitest no corre afterAll si beforeAll
      // lanza, así que hay que autolimpiar antes de relanzar.
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(
        `No se pudo dar acceso al owner demo a la residencia de test (¿límite de 10 residencias activas?): ${residenceUsersError.message}`,
      );
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
    if (!admin) return;
    await admin.from("application_snapshots").delete().eq("room_type_id", roomTypeId);
    await admin.from("application_requests").delete().eq("residence_id", residenceId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

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
        created_by_user_id: createdByUserId,
      })
      .select("id")
      .single();
    // Back-reference que createApplicationFromRoomType.ts también setea
    // (application_snapshots.application_request_id) — sin esto la
    // snapshot queda huérfana (application_request_id null) y bloquea el
    // cascade-delete de room_types → residences en el afterAll, porque
    // application_snapshots.room_type_id no tiene "on delete cascade"
    // (db/migrations/0007_application_requests.sql:68).
    await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshot!.id);
    applicationIds.push(application!.id);
    return application!.id;
  }

  it("entra directo si hay menos de 3 solicitudes visibles", async () => {
    const result = await determineInitialApplicationStatus(admin, roomTypeId);
    expect(result).toEqual({ status: "submitted" });
  });

  it(`entra en cola cuando ya hay ${MAX_VISIBLE_PER_ROOM_TYPE} visibles`, async () => {
    await insertFixtureApplication("submitted");
    await insertFixtureApplication("under_review");
    await insertFixtureApplication("contact_established");

    const result = await determineInitialApplicationStatus(admin, roomTypeId);
    expect(result).toEqual({ status: "queued_for_place" });
  });

  it(`rechaza cuando la cola también está completa (${MAX_QUEUED_PER_ROOM_TYPE})`, async () => {
    await insertFixtureApplication("queued_for_place");
    await insertFixtureApplication("queued_for_place");

    const result = await determineInitialApplicationStatus(admin, roomTypeId);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/cola está completa/i);
  });

  it("promueve la más antigua en cola cuando se libera un cupo visible", async () => {
    const { data: queued } = await admin
      .from("application_requests")
      .select("id, created_at")
      .eq("room_type_id", roomTypeId)
      .eq("status", "queued_for_place")
      .order("created_at", { ascending: true });
    expect(queued?.length).toBe(2);
    const oldestQueuedId = queued![0].id;

    // Libera un cupo visible: rechaza la primera solicitud "submitted".
    const { data: visible } = await admin
      .from("application_requests")
      .select("id")
      .eq("room_type_id", roomTypeId)
      .eq("status", "submitted")
      .limit(1)
      .single();
    await admin.from("application_requests").update({ status: "rejected" }).eq("id", visible!.id);

    await promoteNextQueuedApplication(admin, roomTypeId);

    const { data: promoted } = await admin
      .from("application_requests")
      .select("status")
      .eq("id", oldestQueuedId)
      .single();
    expect(promoted!.status).toBe("submitted");

    const { data: stillQueued } = await admin
      .from("application_requests")
      .select("id")
      .eq("room_type_id", roomTypeId)
      .eq("status", "queued_for_place");
    expect(stillQueued?.length).toBe(1);
  });

  it("no promueve nada si ya está al máximo de visibles", async () => {
    const { data: before } = await admin
      .from("application_requests")
      .select("id")
      .eq("room_type_id", roomTypeId)
      .eq("status", "queued_for_place");
    expect(before?.length).toBe(1);

    await promoteNextQueuedApplication(admin, roomTypeId);

    const { data: after } = await admin
      .from("application_requests")
      .select("id")
      .eq("room_type_id", roomTypeId)
      .eq("status", "queued_for_place");
    expect(after?.length).toBe(1);
  });
});
