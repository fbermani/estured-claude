import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";
import { expireApplicationRequests } from "@/lib/jobs/expireApplicationRequests";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireApplicationRequests (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  // Tope de 2 activas por estudiante (0093): la tercera solicitud va con un estudiante descartable.
  let extraStudent: TestStudent;
  let staleSubmittedId: string;
  let staleResidencePaymentId: string;
  let freshAppId: string;
  // DR63: dos solicitudes con el plazo vencido que NO deben vencer («Ya pagué» y «No pude realizar el pago» abierto).
  let reportedStudent: TestStudent;
  let issueStudent: TestStudent;
  let reportedAppId: string;
  let issueAppId: string;
  // El estudiante demo puede tener otra solicitud activa (tope de 2, 0093): la del pago vencido usa un estudiante descartable.
  let payStudent: TestStudent;

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

    extraStudent = await createTestStudent(admin, "expire-apps");
    payStudent = await createTestStudent(admin, "expire-pay");
    async function createApp(status: string, extra: Record<string, unknown>, other?: TestStudent) {
      const snapshotId = await createSnapshot();
      const { data: application } = await admin
        .from("application_requests")
        .insert({
          student_profile_id: other?.profileId ?? studentProfileId,
          initiated_by: "student",
          contact_target: "student",
          residence_id: residenceId,
          room_type_id: roomTypeId,
          status,
          desired_start_date: "2026-08-15",
          initial_duration_months: 6,
          academic_objective: "Objetivo académico de prueba (test de integración).",
          snapshot_original_id: snapshotId,
          created_by_user_id: other?.userId ?? studentUserId,
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
    }, payStudent);
    freshAppId = await createApp("submitted", {
      expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    }, extraStudent);

    reportedStudent = await createTestStudent(admin, "expire-reported");
    issueStudent = await createTestStudent(admin, "expire-issue");
    const overdue = new Date(Date.now() - 3 * 3_600_000).toISOString();
    reportedAppId = await createApp("residence_payment_pending", { payment_deadline_at: overdue, collection_mode: "enabled_methods" }, reportedStudent);
    issueAppId = await createApp("residence_payment_pending", { payment_deadline_at: overdue, collection_mode: "enabled_methods" }, issueStudent);
    await admin.from("external_residence_payments").insert([
      {
        application_request_id: reportedAppId,
        residence_id: residenceId,
        student_profile_id: reportedStudent.profileId,
        status: "student_reported_paid",
        student_reported_paid_at: overdue,
      },
      {
        application_request_id: issueAppId,
        residence_id: residenceId,
        student_profile_id: issueStudent.profileId,
        status: "pending",
        student_payment_issue_at: overdue,
      },
    ]);

    // Ciclo 34terdecies: createPendingResidencePayment (Ciclo 8) crea esta fila
    // real al entrar a residence_payment_pending — se replica acá para poder
    // testear que el job la sincroniza a `expired` al vencer la solicitud.
    await admin.from("external_residence_payments").insert({
      application_request_id: staleResidencePaymentId,
      residence_id: residenceId,
      student_profile_id: payStudent.profileId,
      status: "pending",
    });
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin.from("external_residence_payments").delete().eq("application_request_id", staleResidencePaymentId);
    await admin.from("external_residence_payments").delete().in("application_request_id", [reportedAppId, issueAppId].filter(Boolean));
    await admin
      .from("application_requests")
      .delete()
      .in("id", [staleSubmittedId, staleResidencePaymentId, freshAppId, reportedAppId, issueAppId].filter(Boolean));
    await deleteResidenceCascade(admin, residenceId);
    if (extraStudent) await deleteTestStudent(admin, extraStudent);
    if (payStudent) await deleteTestStudent(admin, payStudent);
    if (reportedStudent) await deleteTestStudent(admin, reportedStudent);
    if (issueStudent) await deleteTestStudent(admin, issueStudent);
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

    const { data: residencePayment } = await admin
      .from("external_residence_payments")
      .select("status")
      .eq("application_request_id", staleResidencePaymentId)
      .single();
    expect(residencePayment!.status).toBe("expired");
  });

  it("DR63: no vence «Ya pagué» ni «No pude realizar el pago» abierto, aunque el plazo esté vencido", async () => {
    await expireApplicationRequests(admin);
    for (const [id, paymentStatus] of [
      [reportedAppId, "student_reported_paid"],
      [issueAppId, "pending"],
    ]) {
      const { data: application } = await admin.from("application_requests").select("status").eq("id", id).single();
      expect(application!.status).toBe("residence_payment_pending");
      const { data: residencePayment } = await admin.from("external_residence_payments").select("status").eq("application_request_id", id).single();
      expect(residencePayment!.status).toBe(paymentStatus);
    }
  });
});
