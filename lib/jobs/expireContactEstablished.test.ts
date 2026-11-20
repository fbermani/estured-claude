import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";
import { expireNegotiationProposals } from "@/lib/jobs/expireNegotiationProposals";
import { reactivatePausedApplications } from "@/lib/applications/reactivatePausedApplications";
import { LIVE_RESERVATION_STATUSES } from "@/lib/reservations/reservationStatus";

/**
 * H06 / D6 (Ciclo 49): `contact_established` vence igual que `residence_payment_pending`
 * (docs/04 l.303) y, al vencer, las solicitudes pausadas del estudiante vuelven a `submitted`
 * (docs/04 §5.6). Fixtures en una residencia `residencia-test-*` que se borra por completo.
 * Estudiantes `*@estured.test` sin solicitudes en el seed cubren la reactivación (Valentina:
 * vencimiento por contacto/pago; Ana: propuesta de ajuste vencida; un estudiante descartable creado y borrado por el test: reservas vigentes);
 * Lucía, el vencimiento sin efecto colateral (ya tiene una solicitud avanzada real del seed).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const HOUR = 3_600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();

describe.skipIf(!hasCreds)("vencimiento de contact_established (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let valentina: { userId: string; profileId: string };
  let ana: { userId: string; profileId: string };
  let mateo: TestStudent;
  // Tope de 2 activas por estudiante (0093): estudiantes descartables para las solicitudes que sobrarían.
  let extraA: TestStudent;
  let extraB: TestStudent;
  let lucia: { userId: string; profileId: string };
  const appIds: string[] = [];

  async function findStudent(email: string) {
    const { data: user } = await admin.from("users").select("id").eq("email", email).single();
    const { data: profile } = await admin.from("student_profiles").select("id").eq("user_id", user!.id).single();
    return { userId: user!.id as string, profileId: profile!.id as string };
  }

  async function createApp(student: { userId: string; profileId: string }, status: string, extra: Record<string, unknown>) {
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
        status,
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_original_id: snapshot!.id,
        created_by_user_id: student.userId,
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw new Error(`fixture: ${error.message}`);
    await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshot!.id);
    appIds.push(application!.id);
    return application!.id as string;
  }

  async function statusOf(id: string) {
    const { data } = await admin.from("application_requests").select("status, expires_at").eq("id", id).single();
    return data!;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    valentina = await findStudent("valentina.maidana@estured.test");
    ana = await findStudent("ana.jara@estured.test");
    mateo = await createTestStudent(admin, "expire-contact");
    extraA = await createTestStudent(admin, "expire-contact-a");
    extraB = await createTestStudent(admin, "expire-contact-b");
    lucia = await findStudent("lucia.fernandez@example.com");

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 49 — vencer contacto establecido)",
        slug: `residencia-test-expire-contact-${Date.now()}`,
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
      .insert({ residence_id: residenceId, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 })
      .select("id")
      .single();
    roomTypeId = roomType!.id;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    if (appIds.length > 0) {
      await admin.from("application_negotiation_proposals").delete().in("application_request_id", appIds);
      await admin.from("external_residence_payments").update({ reservation_id: null }).in("application_request_id", appIds);
      await admin.from("reservations").delete().in("application_request_id", appIds);
      await admin.from("external_residence_payments").delete().in("application_request_id", appIds);
      await admin.from("application_requests").delete().in("id", appIds);
    }
    await deleteResidenceCascade(admin, residenceId);
    await deleteTestStudent(admin, mateo);
    await deleteTestStudent(admin, extraA);
    await deleteTestStudent(admin, extraB);
  });

  it("vence contact_established con plazo pasado, deja intactas las vigentes y reactiva la pausada del estudiante", async () => {
    // Valentina: contacto establecido vencido + otra solicitud que quedó pausada hace semanas.
    const staleContact = await createApp(valentina, "contact_established", {
      contact_established_at: iso(-72),
      payment_deadline_at: iso(-24),
    });
    const paused = await createApp(valentina, "paused_due_to_other_active_request", { expires_at: iso(-500) });
    // Lucía: una vigente (con plazo), una legacy sin plazo y vencida, una legacy sin plazo y reciente.
    const freshContact = await createApp(lucia, "contact_established", {
      contact_established_at: iso(-24),
      payment_deadline_at: iso(24),
    });
    const legacyStale = await createApp(lucia, "contact_established", { contact_established_at: iso(-72) });
    const legacyFresh = await createApp(extraA, "contact_established", { contact_established_at: iso(-1) });

    const result = await expireApplicationRequests(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(2);

    expect((await statusOf(staleContact)).status).toBe("expired_no_student_payment");
    expect((await statusOf(legacyStale)).status).toBe("expired_no_student_payment");
    expect((await statusOf(freshContact)).status).toBe("contact_established");
    expect((await statusOf(legacyFresh)).status).toBe("contact_established");

    const reactivated = await statusOf(paused);
    expect(reactivated.status).toBe("submitted");
    // Supuesto documentado: el plazo de 48 h de respuesta se reinicia, si no la mataría la próxima corrida.
    expect(new Date(reactivated.expires_at).getTime()).toBeGreaterThan(Date.now() + 40 * HOUR);

    const { data: events } = await admin
      .from("application_status_events")
      .select("from_status, to_status, changed_by_role")
      .eq("application_request_id", staleContact);
    expect(events).toContainEqual({
      from_status: "contact_established",
      to_status: "expired_no_student_payment",
      changed_by_role: "system",
    });
    const { data: audit } = await admin
      .from("audit_logs")
      .select("action")
      .eq("entity_id", staleContact)
      .eq("action", "application_expired_no_student_payment");
    expect(audit?.length).toBe(1);
  });

  it("no reactiva la pausada si el estudiante todavía tiene otra solicitud avanzada", async () => {
    await createApp(extraB, "residence_payment_pending", { payment_deadline_at: iso(24) });
    const paused = await createApp(extraB, "paused_due_to_other_active_request", {});

    const result = await reactivatePausedApplications(admin, extraB.profileId);
    expect(result.reactivatedCount).toBe(0);
    expect((await statusOf(paused)).status).toBe("paused_due_to_other_active_request");
  });

  it("reactiva la pausada cuando vence la propuesta de ajuste sin respuesta", async () => {
    const offer = await createApp(ana, "offer_pending_student_acceptance", { payment_deadline_at: iso(-3) });
    await admin.from("application_negotiation_proposals").insert({
      application_request_id: offer,
      sent_by_user_id: ownerId,
      residence_id: residenceId,
      proposed_monthly_price_usd: 280,
      expires_at: iso(-3),
    });
    const paused = await createApp(ana, "paused_due_to_other_active_request", { expires_at: iso(-200) });

    await expireNegotiationProposals(admin);

    expect((await statusOf(offer)).status).toBe("expired_offer_no_response");
    expect((await statusOf(paused)).status).toBe("submitted");
  });

  it("solo las reservas no vigentes dejan reactivar: con cualquier estado vigente la pausada sigue pausada", async () => {
    const converted = await createApp(mateo, "converted_to_reservation", {});
    const paused = await createApp(mateo, "paused_due_to_other_active_request", {});
    const { data: payment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: converted,
        residence_id: residenceId,
        student_profile_id: mateo.profileId,
        status: "reported_received_by_residence",
      })
      .select("id")
      .single();
    const { data: app } = await admin.from("application_requests").select("snapshot_original_id").eq("id", converted).single();
    const { data: reservation, error } = await admin
      .from("reservations")
      .insert({
        application_request_id: converted,
        student_profile_id: mateo.profileId,
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "pending_estured_fee",
        start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: app!.snapshot_original_id,
        external_residence_payment_id: payment!.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`fixture reserva: ${error.message}`);

    for (const status of LIVE_RESERVATION_STATUSES) {
      const { error: updateError } = await admin.from("reservations").update({ status }).eq("id", reservation!.id);
      if (updateError) throw new Error(`reserva ${status}: ${updateError.message}`);
      const result = await reactivatePausedApplications(admin, mateo.profileId);
      expect(result.reactivatedCount, `reserva ${status}`).toBe(0);
      expect((await statusOf(paused)).status, `reserva ${status}`).toBe("paused_due_to_other_active_request");
    }

    await admin.from("reservations").update({ status: "expired_fee_unpaid" }).eq("id", reservation!.id);
    const result = await reactivatePausedApplications(admin, mateo.profileId);
    expect(result.reactivatedCount).toBe(1);
    expect((await statusOf(paused)).status).toBe("submitted");
  });
});
