import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { resetFeePayersOnLinkEnd, setFeePayer } from "@/lib/family/setFeePayer";
import { loadFamilyOverview } from "@/lib/family/loadFamilyOverview";
import { loadActiveFamilyLink } from "@/lib/family/access";
import { notifyFamilyApplicationMilestone, notifyFamilyReservationMilestone } from "@/lib/family/familyMilestones";

/**
 * Ciclo 61 (DR4) — el familiar vinculado puede PAGAR (ser `payer_user_id`), SEGUIR (overview en solo lectura) y recibe
 * avisos de hitos. Integración contra estured-dev: reserva `pending_estured_fee` de Lucía (Martín es su familiar activo).
 * Camila no tiene familiar vinculado: no se avisa a nadie.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("familiar pagador y avisos (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let luciaUserId: string;
  let luciaProfileId: string;
  let martinUserId: string;
  let camilaUserId: string;
  let camilaProfileId: string;
  let appId: string;
  let camilaAppId: string;
  let reservationId: string;
  let residencePaymentId: string;
  let feePaymentId: string;
  const notificationEntityIds: string[] = [];

  async function martinNotifications(entityId: string) {
    const { data } = await admin
      .from("notifications")
      .select("title")
      .eq("user_id", martinUserId)
      .eq("related_entity_id", entityId);
    return (data ?? []).map((n) => n.title as string);
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const userId = async (email: string) => (await admin.from("users").select("id").eq("email", email).single()).data!.id as string;
    const profileId = async (uid: string) => (await admin.from("student_profiles").select("id").eq("user_id", uid).single()).data!.id as string;
    const ownerId = await userId("owner.residencia.norte@example.com");
    luciaUserId = await userId("lucia.fernandez@example.com");
    martinUserId = await userId("padre.lucia@example.com");
    camilaUserId = await userId("camila.rojas@example.com");
    luciaProfileId = await profileId(luciaUserId);
    camilaProfileId = await profileId(camilaUserId);

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 61 — familiar pagador)",
        slug: `residencia-test-family-payer-${Date.now()}`,
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
    const { data: snapshot } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: residenceId,
        room_type_id: roomType!.id,
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
    const baseApp = {
      initiated_by: "student",
      contact_target: "student",
      residence_id: residenceId,
      room_type_id: roomType!.id,
      desired_start_date: "2027-08-15",
      initial_duration_months: 6,
      academic_objective: "Objetivo académico de prueba (test de integración).",
    };
    const { data: app } = await admin
      .from("application_requests")
      .insert({ ...baseApp, student_profile_id: luciaProfileId, status: "converted_to_reservation", snapshot_original_id: snapshot!.id, created_by_user_id: luciaUserId })
      .select("id")
      .single();
    appId = app!.id;
    await admin.from("application_snapshots").update({ application_request_id: appId }).eq("id", snapshot!.id);
    const { data: camilaApp, error: camilaAppError } = await admin
      .from("application_requests")
      .insert({ ...baseApp, student_profile_id: camilaProfileId, status: "rejected", snapshot_original_id: snapshot!.id, created_by_user_id: camilaUserId })
      .select("id")
      .single();
    if (camilaAppError) throw camilaAppError;
    camilaAppId = camilaApp!.id;

    const { data: erp } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: appId,
        residence_id: residenceId,
        student_profile_id: luciaProfileId,
        status: "reported_received_by_residence",
        reported_received_by_user_id: ownerId,
        reported_received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    residencePaymentId = erp!.id;
    const { data: reservation } = await admin
      .from("reservations")
      .insert({
        application_request_id: appId,
        student_profile_id: luciaProfileId,
        residence_id: residenceId,
        room_type_id: roomType!.id,
        status: "pending_estured_fee",
        start_date: "2027-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: snapshot!.id,
        external_residence_payment_id: residencePaymentId,
      })
      .select("id")
      .single();
    reservationId = reservation!.id;
    await admin.from("external_residence_payments").update({ reservation_id: reservationId }).eq("id", residencePaymentId);
    const { data: fee } = await admin
      .from("estured_fee_payments")
      .insert({
        reservation_id: reservationId,
        payer_user_id: luciaUserId,
        beneficiary_student_profile_id: luciaProfileId,
        status: "pending_payment_method",
        fee_base_usd: 1800,
        fee_base_ars: 2736000,
        fee_amount_ars: 136500,
        expires_at: new Date(Date.now() + 40 * 3600000).toISOString(),
      })
      .select("id")
      .single();
    feePaymentId = fee!.id;
    await admin.from("reservations").update({ estured_fee_payment_id: feePaymentId }).eq("id", reservationId);
    notificationEntityIds.push(appId, camilaAppId, reservationId);
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    for (const id of notificationEntityIds) await admin.from("notifications").delete().eq("related_entity_id", id);
    await admin.from("audit_logs").delete().eq("entity_id", feePaymentId).eq("action", "estured_fee_payer_changed");
    await admin.from("reservations").update({ estured_fee_payment_id: null, booking_receipt_id: null }).eq("id", reservationId);
    await admin.from("estured_fee_payments").delete().eq("id", feePaymentId);
    await admin.from("external_residence_payments").update({ reservation_id: null }).eq("id", residencePaymentId);
    await admin.from("reservations").delete().eq("id", reservationId);
    await admin.from("external_residence_payments").delete().eq("id", residencePaymentId);
    await admin.from("application_requests").delete().in("id", [appId, camilaAppId]);
    await deleteResidenceCascade(admin, residenceId);
  });

  it("vínculo activo: Martín es familiar de Lucía y no de Camila", async () => {
    expect(await loadActiveFamilyLink(admin, martinUserId, luciaProfileId)).not.toBeNull();
    expect(await loadActiveFamilyLink(admin, martinUserId, camilaProfileId)).toBeNull();
  });

  it("solo la estudiante beneficiaria puede designar al pagador", async () => {
    const other = await setFeePayer(admin, { actorUserId: camilaUserId, applicationId: appId, payer: "family" });
    expect(other.ok).toBe(false);
    const family = await setFeePayer(admin, { actorUserId: martinUserId, applicationId: appId, payer: "family" });
    expect(family.ok).toBe(false);
  });

  it("Camila no tiene familiar vinculado: no puede designar pagador familiar", async () => {
    const result = await setFeePayer(admin, { actorUserId: camilaUserId, applicationId: camilaAppId, payer: "family" });
    expect(result.ok).toBe(false);
  });

  it("Lucía designa a Martín: cambia el pagador, audita y avisa a Martín", async () => {
    const result = await setFeePayer(admin, { actorUserId: luciaUserId, applicationId: appId, payer: "family" });
    expect(result).toEqual({ ok: true, payerUserId: martinUserId });
    const { data: fee } = await admin.from("estured_fee_payments").select("payer_user_id").eq("id", feePaymentId).single();
    expect(fee?.payer_user_id).toBe(martinUserId);
    expect(await martinNotifications(reservationId)).toEqual(["Te designaron para pagar el fee EstuRed"]);
    const { data: audit } = await admin.from("audit_logs").select("action").eq("entity_id", feePaymentId).eq("action", "estured_fee_payer_changed");
    expect(audit?.length).toBe(1);
  });

  it("el overview de Martín muestra la solicitud con 'pagar el fee' como próxima acción y sin datos privados", async () => {
    const overview = await loadFamilyOverview(admin, martinUserId);
    const lucia = overview.find((o) => o.studentProfileId === luciaProfileId);
    expect(lucia).toBeDefined();
    expect(overview.some((o) => o.studentProfileId === camilaProfileId)).toBe(false);
    const view = lucia!.applications.find((a) => a.id === appId);
    expect(view?.nextAction).toMatchObject({ kind: "pay_fee", href: `/students/applications/${appId}/fee` });
    expect(Object.keys(view!).sort()).toEqual(
      ["area", "desiredStartDate", "id", "isClosed", "nextAction", "residenceName", "roomTypeName", "statusLabel", "statusTone"].sort(),
    );
  });

  it("vuelve a pagar Lucía: Martín deja de ser pagador, se entera y su próxima acción pasa a 'esperando'", async () => {
    const result = await setFeePayer(admin, { actorUserId: luciaUserId, applicationId: appId, payer: "self" });
    expect(result).toEqual({ ok: true, payerUserId: luciaUserId });
    expect(await martinNotifications(reservationId)).toContain("Ya no sos el pagador del fee EstuRed");
    const overview = await loadFamilyOverview(admin, martinUserId);
    const view = overview.find((o) => o.studentProfileId === luciaProfileId)!.applications.find((a) => a.id === appId);
    expect(view?.nextAction).toMatchObject({ kind: "waiting_fee_payment", payerView: "student_pays" });
  });

  it("al revocarse el vínculo el pago vuelve al estudiante (y Lucía puede volver a 'pago yo' aunque no haya familiar)", async () => {
    await setFeePayer(admin, { actorUserId: luciaUserId, applicationId: appId, payer: "family" });
    const reassigned = await resetFeePayersOnLinkEnd(admin, { studentProfileId: luciaProfileId, studentUserId: luciaUserId, familyUserId: martinUserId });
    expect(reassigned).toBeGreaterThanOrEqual(1);
    const { data: fee } = await admin.from("estured_fee_payments").select("payer_user_id").eq("id", feePaymentId).single();
    expect(fee?.payer_user_id).toBe(luciaUserId);
  });

  it("no se cambia el pagador si ya hay un comprobante en curso", async () => {
    await admin.from("estured_fee_payments").update({ status: "pending_manual_payment" }).eq("id", feePaymentId);
    const result = await setFeePayer(admin, { actorUserId: luciaUserId, applicationId: appId, payer: "family" });
    expect(result.ok).toBe(false);
    await admin.from("estured_fee_payments").update({ status: "pending_payment_method" }).eq("id", feePaymentId);
  });

  it("hitos: avisan al familiar vinculado de Lucía y a nadie en el caso de Camila", async () => {
    await notifyFamilyReservationMilestone(admin, reservationId, "fee_to_pay");
    expect((await martinNotifications(reservationId)).some((t) => t.startsWith("Fee EstuRed a pagar — reserva de Lucia"))).toBe(true);

    await notifyFamilyApplicationMilestone(admin, appId, "accepted");
    const accepted = await martinNotifications(appId);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toContain("aceptó la solicitud");

    await notifyFamilyApplicationMilestone(admin, camilaAppId, "accepted");
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("related_entity_id", camilaAppId);
    expect(count).toBe(0);
  });

  it("excludeUserIds evita el aviso duplicado al pagador", async () => {
    const before = (await martinNotifications(reservationId)).length;
    await notifyFamilyReservationMilestone(admin, reservationId, "fee_expired", { excludeUserIds: [martinUserId] });
    expect((await martinNotifications(reservationId)).length).toBe(before);
  });
});
