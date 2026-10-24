import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { addMonthsIso } from "@/lib/students/contractEnd";
import { checkReservationWindowOverlap, describeReservationWindow } from "@/lib/students/reservationWindow";
import { joinWaitlist } from "@/lib/waitlist-entries/joinWaitlist";
import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";
import { endResidentStay } from "@/lib/residents/endResidentStay";
import { expireStayChangeIntents } from "@/lib/jobs/expireStayChangeIntents";
import { notificationHref } from "@/lib/notifications/links";
import { createStayChangeIntent } from "@/lib/stayChange/createStayChangeIntent";
import { updateStayChangeIntent } from "@/lib/stayChange/updateStayChangeIntent";
import { cancelStayChangeIntent } from "@/lib/stayChange/cancelStayChangeIntent";
import { respondStayChangeIntent } from "@/lib/stayChange/respondStayChangeIntent";
import { confirmStayChangeIntentByFamily, confirmStillSearching, markStayChangeResponseSeen } from "@/lib/stayChange/studentFollowUps";
import { resolveStayChangeIntentOnReservation } from "@/lib/stayChange/resolveStayChangeIntent";
import { advanceUnlockAt, checkStayChangeAdvanceGate, formatAdvanceAt, stayChangeAdvanceAt } from "@/lib/stayChange/advanceGate";
import { loadFamilyStayChange, loadResidenceStayChanges, loadStudentStayChange } from "@/lib/stayChange/load";
import { saveStudentExitNote } from "@/lib/stayChange/recordEarlyExit";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";
import { describeStayChangeState, grantsOverlapException, isVisibleToResidence, stayChangeExpiryFrom } from "@/lib/stayChange/status";
import {
  isValidDateOnly,
  validateEarlyExitPolicy,
  validateEarlyExitRecord,
  validateMovingNote,
  validateResidenceResponse,
  validateStudentIntentInput,
} from "@/lib/stayChange/validate";
import { STAY_CHANGE_TEMPLATE_KEYS, buildInitialResponse, buildTemplate, hasPromissoryLanguage, minimumStayFulfilledOn, suggestTemplate, type StayChangeTemplateContext } from "@/lib/stayChange/templates";

const NOW = new Date("2026-10-23T15:00:00Z");

describe("estado del aviso (puro)", () => {
  it("solo `open` habilita la excepción; los pendientes de familiar no se le muestran a la residencia", () => {
    expect(grantsOverlapException("open")).toBe(true);
    for (const s of ["pending_guardian_confirmation", "cancelled_by_student", "resolved_new_reservation", "expired"] as const) {
      expect(grantsOverlapException(s)).toBe(false);
    }
    expect(isVisibleToResidence("pending_guardian_confirmation")).toBe(false);
    expect(isVisibleToResidence("open")).toBe(true);
  });

  it("estado visible: sin respuesta, respondido, por vencer (≤10 días) y terminales", () => {
    const expiresFar = stayChangeExpiryFrom(NOW).toISOString();
    expect(describeStayChangeState({ status: "open", residenceRespondedAt: null, expiresAt: expiresFar }, NOW).key).toBe("open_no_response");
    expect(describeStayChangeState({ status: "open", residenceRespondedAt: "2026-10-24T00:00:00Z", expiresAt: expiresFar }, NOW).key).toBe("open_responded");
    const soon = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    const expiring = describeStayChangeState({ status: "open", residenceRespondedAt: null, expiresAt: soon }, NOW);
    expect(expiring.key).toBe("open_expiring");
    expect(expiring.daysToExpiry).toBe(5);
    expect(describeStayChangeState({ status: "pending_guardian_confirmation", residenceRespondedAt: null, expiresAt: null }, NOW).key).toBe("pending_family");
    expect(describeStayChangeState({ status: "resolved_new_reservation", residenceRespondedAt: null, expiresAt: null }, NOW).isActive).toBe(false);
    expect(describeStayChangeState({ status: "cancelled_by_student", residenceRespondedAt: null, expiresAt: null }, NOW).label).toBe("Cancelado");
  });

  it("vence a los 90 días", () => {
    expect(stayChangeExpiryFrom(NOW).toISOString()).toBe("2027-01-21T15:00:00.000Z");
  });
});

describe("validaciones (puro)", () => {
  it("fecha estimada: válida, no anterior a hoy; mensaje hasta 500", () => {
    expect(isValidDateOnly("2026-02-31")).toBe(false);
    expect(validateStudentIntentInput({ estimatedExitDate: "2026-10-22" }, NOW).ok).toBe(false);
    expect(validateStudentIntentInput({ estimatedExitDate: "no-fecha" }, NOW).ok).toBe(false);
    expect(validateStudentIntentInput({ studentMessage: "x".repeat(501) }, NOW).ok).toBe(false);
    const ok = validateStudentIntentInput({ estimatedExitDate: "2026-12-15", studentMessage: "  Me cambio de facultad.  " }, NOW);
    expect(ok).toEqual({ ok: true, value: { estimatedExitDate: "2026-12-15", studentMessage: "Me cambio de facultad." } });
    expect(validateStudentIntentInput({}, NOW)).toEqual({ ok: true, value: { estimatedExitDate: null, studentMessage: null } });
  });

  it("respuesta de la residencia: mensaje mínimo 20, campos hasta 1000, monto 0–100000", () => {
    expect(validateResidenceResponse({ message: "corto" }).ok).toBe(false);
    expect(validateResidenceResponse({ message: "Gracias por avisarnos con tiempo, te contamos.", exitCostsUsd: "-1" }).ok).toBe(false);
    expect(validateResidenceResponse({ message: "Gracias por avisarnos con tiempo, te contamos.", exitCostsText: "x".repeat(1001) }).ok).toBe(false);
    const ok = validateResidenceResponse({ message: "Gracias por avisarnos con tiempo, te contamos.", exitCostsUsd: "350,5", exitCostsText: " Se pierde el depósito. " });
    expect(ok.ok && ok.value.exitCostsUsd).toBe(350.5);
    expect(ok.ok && ok.value.exitCostsText).toBe("Se pierde el depósito.");
  });

  it("política de salida y nota de mudanza", () => {
    expect(validateEarlyExitPolicy({ costsText: "x".repeat(1001) }).ok).toBe(false);
    expect(validateEarlyExitPolicy({ depositClausesText: " Se devuelve en 30 días. " })).toEqual({
      ok: true,
      value: { depositClausesText: "Se devuelve en 30 días.", costsText: null, conditionsText: null },
    });
    expect(validateMovingNote("x".repeat(501)).ok).toBe(false);
    expect(validateMovingNote("  ")).toEqual({ ok: true, value: null });
  });

  it("cierre de salida anticipada: con depósito hay que decir si se devolvió; sin depósito es 'no_deposit'", () => {
    expect(validateEarlyExitRecord({ exitDate: "2026-10-25", depositStatus: undefined }, { hadDeposit: true }, NOW).ok).toBe(false);
    expect(validateEarlyExitRecord({ exitDate: "2026-10-25", depositStatus: "no_deposit" }, { hadDeposit: true }, NOW).ok).toBe(false);
    expect(validateEarlyExitRecord({ exitDate: "2026-10-25", depositStatus: "returned" }, { hadDeposit: true }, NOW).ok).toBe(true);
    const none = validateEarlyExitRecord({ exitDate: "2026-10-25", depositStatus: "returned" }, { hadDeposit: false }, NOW);
    expect(none.ok && none.value.depositStatus).toBe("no_deposit");
    expect(validateEarlyExitRecord({ exitDate: "", depositStatus: "returned" }, { hadDeposit: true }, NOW).ok).toBe(false);
    expect(validateEarlyExitRecord({ exitDate: "2026-10-25", depositStatus: "no_deposit" }, { hadDeposit: null }, NOW).ok).toBe(true);
    expect(validateEarlyExitRecord({ exitDate: "2026-11-05", depositStatus: "returned" }, { hadDeposit: true }, NOW).ok).toBe(false); // > hoy + 7 días
    expect(validateEarlyExitRecord({ exitDate: "2025-10-01", depositStatus: "returned" }, { hadDeposit: true }, NOW).ok).toBe(false); // > 12 meses atrás
  });
});

describe("plantillas (puro)", () => {
  const ctx: StayChangeTemplateContext = {
    studentFirstName: "Lucía",
    estimatedExitDate: "2026-12-15",
    stayStartDate: "2026-07-20",
    minimumStayMonths: 6,
    depositUsd: 350,
    policy: null,
  };
  it("la estadía mínima se cumple start + meses y solo se sugiere si la salida es anterior", () => {
    expect(minimumStayFulfilledOn(ctx)).toBe("2027-01-20");
    expect(suggestTemplate(ctx)).toBe("min");
    expect(suggestTemplate({ ...ctx, estimatedExitDate: "2027-02-01" })).toBeNull();
    expect(suggestTemplate({ ...ctx, estimatedExitDate: null })).toBeNull();
    expect(suggestTemplate({ ...ctx, minimumStayMonths: null })).toBeNull();
  });
  it("las 4 plantillas completan datos reales y no prometen nada", () => {
    expect(STAY_CHANGE_TEMPLATE_KEYS).toHaveLength(4);
    const min = buildTemplate("min", ctx);
    expect(min.exitCostsText).toContain("20/01/2027");
    expect(min.exitCostsUsd).toBe(350);
    expect(buildTemplate("none", ctx).exitCostsText).toMatch(/No hay costos/);
    expect(buildTemplate("notice", ctx).exitDetailsText).toContain("15/12/2026");
    expect(buildTemplate("listen", ctx).exitCostsText).toBe("");
    for (const key of STAY_CHANGE_TEMPLATE_KEYS) {
      const t = buildTemplate(key, ctx);
      expect(hasPromissoryLanguage(`${t.message} ${t.exitCostsText} ${t.exitConditionsText} ${t.exitDetailsText}`)).toBe(false);
      expect(t.message).toContain("Lucía");
    }
  });
  it("la política del perfil precarga costos y condiciones", () => {
    const withPolicy = { ...ctx, policy: { costsText: "Se pierde el depósito.", conditionsText: "Preaviso de 45 días." } };
    expect(buildTemplate("min", withPolicy).exitCostsText).toBe("Se pierde el depósito.");
    expect(buildTemplate("notice", withPolicy).exitConditionsText).toBe("Preaviso de 45 días.");
    const initial = buildInitialResponse({ ...withPolicy, estimatedExitDate: "2027-03-01" });
    expect(initial.suggestedTemplate).toBeNull();
    expect(initial.exitCostsText).toBe("Se pierde el depósito.");
    expect(initial.message).toBe("");
  });
  it("detecta lenguaje de promesa o mediación", () => {
    expect(hasPromissoryLanguage("Te aseguramos lugar")).toBe(true);
    expect(hasPromissoryLanguage("Hacemos mediación")).toBe(true);
    expect(hasPromissoryLanguage("Preaviso de 30 días")).toBe(false);
  });
});

describe("preaviso de 48 h y copy (puro)", () => {
  it("avanza 48 h después de created_at; para menores, desde la confirmación del familiar", () => {
    expect(stayChangeAdvanceAt({ created_at: "2026-10-23T15:00:00Z", guardian_confirmed_at: null }).toISOString()).toBe("2026-10-25T15:00:00.000Z");
    expect(stayChangeAdvanceAt({ created_at: "2026-10-23T15:00:00Z", guardian_confirmed_at: "2026-10-24T10:00:00Z" }).toISOString()).toBe("2026-10-26T10:00:00.000Z");
    // Si está guardado, manda `payment_unlocked_at`.
    expect(stayChangeAdvanceAt({ created_at: "2026-10-23T15:00:00Z", guardian_confirmed_at: null, payment_unlocked_at: "2026-10-27T09:00:00Z" }).toISOString()).toBe("2026-10-27T09:00:00.000Z");
    expect(advanceUnlockAt(new Date("2026-10-23T15:00:00Z")).toISOString()).toBe("2026-10-25T15:00:00.000Z");
    expect(formatAdvanceAt(new Date("2026-10-25T17:30:00Z"))).toBe("25/10 14:30");
  });
  it("el texto obligatorio sobre impagos no promete ni media", () => {
    expect(UNPAID_DISCLAIMER).toMatch(/no se responsabiliza por mensualidades impagas/);
    expect(hasPromissoryLanguage(UNPAID_DISCLAIMER)).toBe(false);
  });
  it("describeReservationWindow con aviso abierto quita la fecha mínima", () => {
    const w = { startDate: "2026-07-20", endDate: "2027-01-20" };
    expect(describeReservationWindow(w)?.minRequestStartDate).toBe("2027-01-20");
    const open = describeReservationWindow(w, { stayChangeOpen: true });
    expect(open?.minRequestStartDate).toBeNull();
    expect(open?.stayChangeOpen).toBe(true);
    expect(open?.message).toMatch(/Estás buscando cambiar de residencia/);
  });
  it("enlaces de notificación", () => {
    const ID = "3f2b8c1e-7a4d-4b6f-9c2a-1d5e8f0a3b7c";
    const OTHER = "11111111-2222-4333-8444-555555555555";
    expect(notificationHref({ entityType: "stay_change_intents", entityId: ID, area: "student" })).toBe("/students/residency#quiero-cambiar");
    expect(
      notificationHref({ entityType: "stay_change_intents", entityId: ID, area: "residence" }, { residenceIdByEntity: { [`stay_change_intents:${ID}`]: OTHER } }),
    ).toBe(`/residence/${OTHER}/residents?filtro=buscan-cambiar`);
    expect(notificationHref({ entityType: "stay_change_intents", entityId: ID, area: "residence" })).toBeNull();
  });
});

// ==== Integración (contra estured-dev; se saltea sola si falta la migración 0044) ====
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("Quiero cambiar (integración)", () => {
  let admin: SupabaseClient;
  let ready = false;
  let ownerId: string;
  let adminActorId: string;
  let familyUserId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let familyMemberId: string;
  let linkId: string | null = null;
  let currentResidenceId: string; // A
  let targetResidenceId: string; // B
  let roomTypeA: string;
  let fullTypeB: string;
  let reservationId: string;
  const startedAt = new Date().toISOString();
  const todayAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const resStart = todayAr;
  const resEnd = addMonthsIso(resStart, 6);
  let intentId = "";

  async function insertResidence(label: string, roomStatus: "full" | "available_to_confirm"): Promise<{ id: string; roomTypeId: string }> {
    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: `Residencia Test Integración (Ciclo 59 — ${label})`,
        slug: `residencia-test-quiero-cambiar-${label}-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: ownerId,
      })
      .select("id")
      .single();
    const { error: ruError } = await admin.from("residence_users").insert({ residence_id: residence!.id, user_id: ownerId, role: "owner", is_active: true });
    if (ruError) {
      await admin.from("residences").delete().eq("id", residence!.id);
      throw new Error(`No se pudo dar acceso al owner demo: ${ruError.message}`);
    }
    const { data: rt } = await admin
      .from("room_types")
      .insert({ residence_id: residence!.id, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 })
      .select("id")
      .single();
    await admin.from("profile_availability").insert({
      residence_id: residence!.id,
      room_type_id: rt!.id,
      status: roomStatus,
      available_count: roomStatus === "full" ? 0 : 2,
      last_confirmed_by: ownerId,
    });
    return { id: residence!.id, roomTypeId: rt!.id };
  }

  async function createReservation(withDeposit: boolean): Promise<string> {
    const { data: snapshot } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: currentResidenceId,
        room_type_id: roomTypeA,
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        exchange_rate_ars_per_usd: 1520,
        exchange_rate_source: "test",
        exchange_rate_date: todayAr,
        initial_duration_months: 6,
        deposit_usd: withDeposit ? 300 : null,
        adjustment_policy: "quarterly",
        deposit_excluded_from_fee: true,
      })
      .select("id")
      .single();
    const { data: app } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: studentProfileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: currentResidenceId,
        room_type_id: roomTypeA,
        status: "converted_to_reservation",
        desired_start_date: resStart,
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_original_id: snapshot!.id,
        created_by_user_id: studentUserId,
      })
      .select("id")
      .single();
    await admin.from("application_snapshots").update({ application_request_id: app!.id }).eq("id", snapshot!.id);
    const { data: payment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: app!.id,
        residence_id: currentResidenceId,
        student_profile_id: studentProfileId,
        status: "reported_received_by_residence",
        reported_received_by_user_id: ownerId,
        reported_received_at: new Date().toISOString(),
        amount_reported_usd: 300,
        amount_reported_ars: 456000,
      })
      .select("id")
      .single();
    const { data: reservation, error } = await admin
      .from("reservations")
      .insert({
        application_request_id: app!.id,
        student_profile_id: studentProfileId,
        residence_id: currentResidenceId,
        room_type_id: roomTypeA,
        status: "confirmed",
        start_date: resStart,
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: snapshot!.id,
        external_residence_payment_id: payment!.id,
      })
      .select("id")
      .single();
    if (error || !reservation) throw new Error(`fixture de reserva: ${error?.message}`);
    await admin.from("external_residence_payments").update({ reservation_id: reservation.id }).eq("id", payment!.id);
    return reservation.id;
  }

  async function notificationsFor(userId: string, entityId: string) {
    const { data } = await admin.from("notifications").select("title, body").eq("user_id", userId).eq("related_entity_id", entityId);
    return data ?? [];
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    // Si la migración 0044 todavía no está aplicada, el bloque entero se saltea (y lo avisa).
    const probe = await admin.from("stay_change_intents").select("id").limit(1);
    if (probe.error) {
      console.warn("[stayChange.test] migración 0044 sin aplicar en esta base: se saltean los tests de integración.", probe.error.message);
      return;
    }
    ready = true;

    const emailId = async (email: string) => (await admin.from("users").select("id").eq("email", email).single()).data!.id as string;
    ownerId = await emailId("owner.residencia.norte@example.com");
    adminActorId = await emailId("admin.operaciones@estured.test");
    familyUserId = await emailId("padre.lucia@example.com");
    // Valentina Sosa: estudiante demo SIN reservas (menor). Se le crea un vínculo ACTIVO temporal con Martín para probar el flujo de menores.
    studentUserId = await emailId("valentina.sosa@example.com");
    studentProfileId = (await admin.from("student_profiles").select("id").eq("user_id", studentUserId).single()).data!.id as string;
    familyMemberId = (await admin.from("family_members").select("id").eq("user_id", familyUserId).single()).data!.id as string;

    const a = await insertResidence("actual", "available_to_confirm");
    const b = await insertResidence("destino", "full");
    currentResidenceId = a.id;
    roomTypeA = a.roomTypeId;
    targetResidenceId = b.id;
    fullTypeB = b.roomTypeId;
    reservationId = await createReservation(true);
  });

  afterAll(async () => {
    if (!admin || !ready) return;
    if (linkId) await admin.from("family_links").delete().eq("id", linkId);
    for (const userId of [ownerId, studentUserId, familyUserId]) {
      await admin
        .from("notifications")
        .delete()
        .eq("user_id", userId)
        .in("related_entity_type", ["stay_change_intents", "stay_early_exits", "application_requests"])
        .gte("created_at", startedAt);
    }
    await admin.from("notifications").delete().eq("user_id", ownerId).eq("title", "Un estudiante retiró su pedido").gte("created_at", startedAt);
    await admin.from("stay_change_intents").delete().eq("student_profile_id", studentProfileId);
    await deleteResidenceCascade(admin, currentResidenceId);
    await deleteResidenceCascade(admin, targetResidenceId);
  });

  const need = (ctx: { skip: () => void }) => {
    if (!ready) ctx.skip();
    return ready;
  };

  it("menor sin familiar vinculado activo no puede avisar; sin confirmación tampoco", async (ctx) => {
    if (!need(ctx)) return;
    const noConfirm = await createStayChangeIntent(admin, { actorUserId: studentUserId, estimatedExitDate: null, studentMessage: null, confirmed: false });
    expect(noConfirm.ok).toBe(false);
    const minor = await createStayChangeIntent(admin, { actorUserId: studentUserId, estimatedExitDate: null, studentMessage: null, confirmed: true });
    expect(minor.ok).toBe(false);
    if (!minor.ok) expect(minor.error).toMatch(/familiar vinculado/);
  });

  it("menor con familiar: queda pendiente, la residencia no lo ve ni rige la excepción; el familiar lo confirma", async (ctx) => {
    if (!need(ctx)) return;
    const { data: link, error } = await admin
      .from("family_links")
      .insert({ student_profile_id: studentProfileId, family_member_id: familyMemberId, status: "active", requested_by_user_id: familyUserId, approved_at: new Date().toISOString() })
      .select("id")
      .single();
    expect(error?.message ?? null).toBeNull();
    linkId = link!.id;

    const created = await createStayChangeIntent(admin, {
      actorUserId: studentUserId,
      estimatedExitDate: addMonthsIso(todayAr, 2),
      studentMessage: "Mensaje privado del estudiante.",
      confirmed: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    intentId = created.intentId;
    expect(created.status).toBe("pending_guardian_confirmation");

    // Pendiente: no rige la excepción a DR1 y la residencia no recibió nada.
    const blocked = await checkReservationWindowOverlap(admin, {
      studentProfileId,
      desiredStartDate: addMonthsIso(resStart, 1),
      durationMonths: 3,
      residenceId: targetResidenceId,
    });
    expect(blocked.ok).toBe(false);
    expect((await notificationsFor(ownerId, intentId)).filter((n) => /avisó que busca/.test(n.title))).toHaveLength(0);
    expect((await notificationsFor(familyUserId, intentId)).length).toBeGreaterThan(0);
    expect(await loadResidenceStayChanges(admin, currentResidenceId)).toHaveLength(0);

    // Quien no es el familiar no puede confirmar; el familiar sí.
    expect((await confirmStayChangeIntentByFamily(admin, { actorUserId: ownerId, intentId })).ok).toBe(false);
    expect((await confirmStayChangeIntentByFamily(admin, { actorUserId: familyUserId, intentId })).ok).toBe(true);
    const { data: row } = await admin.from("stay_change_intents").select("status, guardian_confirmed_at, expires_at, notice_started_at, payment_unlocked_at, created_by_minor").eq("id", intentId).single();
    expect(row!.status).toBe("open");
    expect(row!.guardian_confirmed_at).not.toBeNull();
    expect(row!.created_by_minor).toBe(true);
    // El preaviso de 48 h corre desde la confirmación del familiar.
    expect(new Date(row!.payment_unlocked_at as string).getTime() - new Date(row!.notice_started_at as string).getTime()).toBe(48 * 3_600_000);
    expect((await notificationsFor(ownerId, intentId)).some((n) => /avisó que busca/.test(n.title))).toBe(true);
    // No se puede abrir otro aviso mientras haya uno vivo.
    const again = await createStayChangeIntent(admin, { actorUserId: studentUserId, estimatedExitDate: null, studentMessage: null, confirmed: true });
    expect(again.ok).toBe(false);
  });

  it("con el aviso abierto se permite superponer hacia OTRA residencia (no hacia la actual) y queda vinculado", async (ctx) => {
    if (!need(ctx)) return;
    const toTarget = await checkReservationWindowOverlap(admin, {
      studentProfileId,
      desiredStartDate: addMonthsIso(resStart, 1),
      durationMonths: 3,
      residenceId: targetResidenceId,
    });
    expect(toTarget).toEqual({ ok: true, stayChangeIntentId: intentId });
    const toCurrent = await checkReservationWindowOverlap(admin, {
      studentProfileId,
      desiredStartDate: addMonthsIso(resStart, 1),
      durationMonths: 3,
      residenceId: currentResidenceId,
    });
    expect(toCurrent.ok).toBe(false);
        const later = await checkReservationWindowOverlap(admin, { studentProfileId, desiredStartDate: resEnd, durationMonths: 3, residenceId: targetResidenceId });
    // Decisión del dueño: también las fechas posteriores (sin superposición) quedan vinculadas al aviso abierto.
    expect(later).toEqual({ ok: true, stayChangeIntentId: intentId });
    const laterToCurrent = await checkReservationWindowOverlap(admin, { studentProfileId, desiredStartDate: resEnd, durationMonths: 3, residenceId: currentResidenceId });
    expect(laterToCurrent).toEqual({ ok: true, stayChangeIntentId: null });
  });

  it("lista de espera y solicitud creadas bajo el aviso quedan vinculadas; la solicitud no avanza a pago antes de 48 h", async (ctx) => {
    if (!need(ctx)) return;
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId: targetResidenceId,
      roomTypeId: fullTypeB,
      desiredStartDate: addMonthsIso(resStart, 1),
      desiredDurationMonths: 3,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const { data: entry } = await admin.from("waitlist_entries").select("stay_change_intent_id").eq("id", joined.waitlistEntryId).single();
    expect(entry!.stay_change_intent_id).toBe(intentId);

    const app = await createApplicationFromRoomType(admin, {
      studentProfileId,
      residenceId: targetResidenceId,
      roomTypeId: fullTypeB,
      roomType: { monthly_price_usd: 300 },
      desiredStartDate: addMonthsIso(resStart, 1),
      durationMonths: 3,
      academicObjective: "Objetivo académico de prueba (test de integración).",
      initiatedBy: "student",
      contactTarget: "student",
      familyLinkId: null,
      familyProposalId: null,
      createdByUserId: studentUserId,
      actorRole: "student",
      stayChangeIntentId: intentId,
      movingContextNote: "Me mudo desde otra residencia por la distancia.",
    });
    expect("id" in app).toBe(true);
    if (!("id" in app)) return;
    const { data: row } = await admin.from("application_requests").select("stay_change_intent_id, move_context_note").eq("id", app.id).single();
    expect(row!.stay_change_intent_id).toBe(intentId);
    expect(row!.move_context_note).toMatch(/otra residencia/);

    const blocked = await checkStayChangeAdvanceGate(admin, { applicationId: app.id, audience: "student" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/^Podés avanzar con la reserva desde \d{2}\/\d{2} \d{2}:\d{2}/);
    const forResidence = await checkStayChangeAdvanceGate(admin, { applicationId: app.id, audience: "residence" });
    expect(forResidence.ok).toBe(false);
    const later = await checkStayChangeAdvanceGate(admin, { applicationId: app.id, audience: "student" }, new Date(Date.now() + 49 * 3_600_000));
    expect(later.ok).toBe(true);
    // Una solicitud sin aviso no tiene preaviso.
    const { data: plain } = await admin.from("application_requests").select("id").eq("student_profile_id", studentProfileId).is("stay_change_intent_id", null).limit(1);
    if (plain?.[0]) expect((await checkStayChangeAdvanceGate(admin, { applicationId: plain[0].id as string, audience: "student" })).ok).toBe(true);
    expect(stayChangeAdvanceAt({ created_at: startedAt, guardian_confirmed_at: null }).getTime()).toBeGreaterThan(Date.now());
  });

  it("la residencia actual responde (solo su equipo), edita, el estudiante la ve y el familiar la lee SIN el mensaje privado", async (ctx) => {
    if (!need(ctx)) return;
    const short = await respondStayChangeIntent(admin, { actorUserId: ownerId, intentId, message: "corto", exitCostsText: null, exitCostsUsd: null, exitConditionsText: null, exitDetailsText: null });
    expect(short.ok).toBe(false);
    const outsider = await respondStayChangeIntent(admin, {
      actorUserId: adminActorId,
      intentId,
      message: "Gracias por avisarnos con tiempo, te contamos cómo sería.",
      exitCostsText: null,
      exitCostsUsd: null,
      exitConditionsText: null,
      exitDetailsText: null,
    });
    expect(outsider.ok).toBe(false);

    const first = await respondStayChangeIntent(admin, {
      actorUserId: ownerId,
      intentId,
      message: "Gracias por avisarnos con tiempo, te contamos cómo sería.",
      exitCostsText: "Se pierde el depósito.",
      exitCostsUsd: "300",
      exitConditionsText: "Preaviso de 30 días.",
      exitDetailsText: "Entrega con administración.",
    });
    expect(first).toEqual({ ok: true, edited: false });
    const studentNotes = await notificationsFor(studentUserId, intentId);
    expect(studentNotes.some((n) => n.body.includes(UNPAID_DISCLAIMER))).toBe(true);

    expect((await markStayChangeResponseSeen(admin, { actorUserId: studentUserId, intentId })).ok).toBe(true);
    const second = await respondStayChangeIntent(admin, {
      actorUserId: ownerId,
      intentId,
      message: "Gracias por avisarnos con tiempo, actualizamos los datos.",
      exitCostsText: "Se pierde el depósito.",
      exitCostsUsd: "300",
      exitConditionsText: "Preaviso de 45 días.",
      exitDetailsText: null,
    });
    expect(second).toEqual({ ok: true, edited: true });
    const view = await loadStudentStayChange(admin, studentProfileId);
    expect(view?.studentMessage).toBe("Mensaje privado del estudiante.");
    expect(view?.response?.edited).toBe(true);
    expect(view?.response?.seenByStudentAt).toBeNull(); // la edición reinicia el "visto"
    expect(view?.linked).toMatchObject({ applications: 1, waitlist: 1 });

    const family = await loadFamilyStayChange(admin, { familyUserId, studentProfileId });
    expect(family?.studentMessage).toBeNull();
    expect(family?.response?.exitCostsText).toBe("Se pierde el depósito.");
    expect(await loadFamilyStayChange(admin, { familyUserId: ownerId, studentProfileId })).toBeNull();

    const items = await loadResidenceStayChanges(admin, currentResidenceId);
    expect(items).toHaveLength(1);
    expect(items[0].studentMessage).toBe("Mensaje privado del estudiante.");
    expect(await loadResidenceStayChanges(admin, targetResidenceId)).toHaveLength(0); // otras residencias: nada
  });

  it("el estudiante edita su aviso (auditado) y puede extenderlo con 'seguir buscando'", async (ctx) => {
    if (!need(ctx)) return;
    const edit = await updateStayChangeIntent(admin, { actorUserId: studentUserId, intentId, estimatedExitDate: addMonthsIso(todayAr, 3), studentMessage: "Mensaje actualizado." });
    expect(edit.ok).toBe(true);
    const { data: row } = await admin.from("stay_change_intents").select("student_message, student_edited_at").eq("id", intentId).single();
    expect(row!.student_message).toBe("Mensaje actualizado.");
    expect(row!.student_edited_at).not.toBeNull();
    const { data: audit } = await admin.from("audit_logs").select("old_value, new_value").eq("entity_type", "stay_change_intents").eq("entity_id", intentId).eq("action", "stay_change_intent_updated");
    expect(audit).toHaveLength(1);
    expect(await updateStayChangeIntent(admin, { actorUserId: familyUserId, intentId, estimatedExitDate: null, studentMessage: null })).toMatchObject({ ok: false });
    // Límite de ediciones por aviso (5).
    for (let i = 0; i < 4; i++) {
      expect((await updateStayChangeIntent(admin, { actorUserId: studentUserId, intentId, estimatedExitDate: null, studentMessage: `Edición ${i}` })).ok).toBe(true);
    }
    const sixth = await updateStayChangeIntent(admin, { actorUserId: studentUserId, intentId, estimatedExitDate: null, studentMessage: "Una más" });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error).toMatch(/5 veces/);
    const keep = await confirmStillSearching(admin, { actorUserId: studentUserId, intentId });
    expect(keep.ok).toBe(true);
  });

  it("cancelar se bloquea con pago en curso; si no, cierra solicitudes y listas creadas bajo el aviso y avisa a esas residencias", async (ctx) => {
    if (!need(ctx)) return;
    const { data: apps } = await admin.from("application_requests").select("id, status").eq("stay_change_intent_id", intentId);
    const appId = apps![0].id as string;
    await admin.from("application_requests").update({ status: "residence_payment_pending" }).eq("id", appId);
    const blocked = await cancelStayChangeIntent(admin, { actorUserId: studentUserId, intentId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Soporte/);
      expect(blocked.blockingApplicationIds).toEqual([appId]);
    }
    expect((await cancelStayChangeIntent(admin, { actorUserId: ownerId, intentId })).ok).toBe(false); // no es el estudiante

    await admin.from("application_requests").update({ status: "contact_established" }).eq("id", appId);
    const cancelled = await cancelStayChangeIntent(admin, { actorUserId: studentUserId, intentId });
    expect(cancelled).toEqual({ ok: true, closedApplications: 1, closedWaitlist: 1 });

    const { data: after } = await admin.from("application_requests").select("status, cancelled_reason").eq("id", appId).single();
    expect(after!.status).toBe("cancelled_by_student");
    expect(after!.cancelled_reason).toBe("stay_change_cancelled");
    const { data: list } = await admin.from("waitlist_entries").select("status, removed_reason").eq("stay_change_intent_id", intentId);
    expect(list![0]).toMatchObject({ status: "removed_by_student", removed_reason: "stay_change_cancelled" });
    const { data: intent } = await admin.from("stay_change_intents").select("status").eq("id", intentId).single();
    expect(intent!.status).toBe("cancelled_by_student");

    // La solicitud colgada de un aviso cancelado no puede avanzar a pago.
    expect((await checkStayChangeAdvanceGate(admin, { applicationId: appId, audience: "residence" }, new Date(Date.now() + 49 * 3_600_000))).ok).toBe(false);
    // Vuelve a regir DR1.
    const blockedAgain = await checkReservationWindowOverlap(admin, { studentProfileId, desiredStartDate: addMonthsIso(resStart, 1), durationMonths: 3, residenceId: targetResidenceId });
    expect(blockedAgain.ok).toBe(false);
    // Una vez cerrado, no se puede cancelar de nuevo.
    expect((await cancelStayChangeIntent(admin, { actorUserId: studentUserId, intentId })).ok).toBe(false);
  });

  it("una reserva nueva confirmada en otra residencia resuelve el aviso y la residencia actual recibe solo la fecha", async (ctx) => {
    if (!need(ctx)) return;
    // Anti-spam: 1 aviso nuevo cada 24 h. Recién cancelado el anterior, todavía no se puede avisar de nuevo.
    const tooSoon = await createStayChangeIntent(admin, { actorUserId: studentUserId, estimatedExitDate: null, studentMessage: null, confirmed: true });
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) expect(tooSoon.error).toMatch(/hace poco/);
    await admin.from("stay_change_intents").update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("student_profile_id", studentProfileId);
    const created = await createStayChangeIntent(admin, { actorUserId: studentUserId, estimatedExitDate: null, studentMessage: null, confirmed: true });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await confirmStayChangeIntentByFamily(admin, { actorUserId: familyUserId, intentId: created.intentId });
    const newStart = addMonthsIso(todayAr, 2);

    // Misma residencia o la propia reserva vigente: no resuelve.
    expect(await resolveStayChangeIntentOnReservation(admin, { studentProfileId, newReservationId: reservationId, newResidenceId: targetResidenceId, newStartDate: newStart })).toBeNull();
    expect(await resolveStayChangeIntentOnReservation(admin, { studentProfileId, newReservationId: "00000000-0000-4000-8000-000000000000", newResidenceId: currentResidenceId, newStartDate: newStart })).toBeNull();

    // `reservation_id` del aviso ES la reserva vigente: tampoco cuenta como "reserva nueva" (se verifica arriba). Para resolver hace
    // falta una reserva existente distinta (referencia FK).
    const { data: otherRes } = await admin.from("reservations").select("id").neq("id", reservationId).limit(1).single();
    const real = await resolveStayChangeIntentOnReservation(admin, { studentProfileId, newReservationId: otherRes!.id as string, newResidenceId: targetResidenceId, newStartDate: newStart });
    expect(real).toBe(created.intentId);
    const { data: row } = await admin.from("stay_change_intents").select("status, resolved_new_start_date, resolved_reservation_id").eq("id", created.intentId).single();
    expect(row).toMatchObject({ status: "resolved_new_reservation", resolved_new_start_date: newStart });
    const ownerNotes = await notificationsFor(ownerId, created.intentId);
    const concrete = ownerNotes.find((n) => /reserva confirmada a partir de/.test(n.body));
    expect(concrete).toBeTruthy();
    expect(concrete!.body).not.toContain("Destino");
    expect(concrete!.body).toMatch(/en otra residencia/);
    // La residencia actual ve el resuelto con la fecha, sin saber cuál es la nueva.
    const items = await loadResidenceStayChanges(admin, currentResidenceId);
    expect(items[0]).toMatchObject({ status: "resolved_new_reservation", resolvedNewStartDate: newStart });
  });

  it("job: recuerda a los 80 días y vence a los 90 cerrando lo creado bajo el aviso", async (ctx) => {
    if (!need(ctx)) return;
    const insertIntent = async (expiresAt: string) => {
      const { data, error } = await admin
        .from("stay_change_intents")
        .insert({ student_profile_id: studentProfileId, reservation_id: reservationId, current_residence_id: currentResidenceId, status: "open", expires_at: expiresAt, created_by_user_id: studentUserId })
        .select("id")
        .single();
      expect(error?.message ?? null).toBeNull();
      return data!.id as string;
    };
    const soon = await insertIntent(new Date(Date.now() + 5 * 86_400_000).toISOString());
    const first = await expireStayChangeIntents(admin);
    expect(first.remindedCount).toBeGreaterThanOrEqual(1);
    const { data: reminded } = await admin.from("stay_change_intents").select("status, last_keep_alive_notified_at").eq("id", soon).single();
    expect(reminded!.status).toBe("open");
    expect(reminded!.last_keep_alive_notified_at).not.toBeNull();
    expect((await expireStayChangeIntents(admin)).remindedCount).toBe(0); // idempotente
    await admin.from("stay_change_intents").update({ status: "cancelled_by_student" }).eq("id", soon);

    const past = await insertIntent(new Date(Date.now() - 3_600_000).toISOString());
    const waitlist = await joinWaitlist(admin, { actorUserId: studentUserId, residenceId: targetResidenceId, roomTypeId: fullTypeB, desiredStartDate: addMonthsIso(resStart, 1), desiredDurationMonths: 3 });
    expect(waitlist.ok).toBe(true);
    const run = await expireStayChangeIntents(admin);
    expect(run.expiredCount).toBeGreaterThanOrEqual(1);
    const { data: expired } = await admin.from("stay_change_intents").select("status").eq("id", past).single();
    expect(expired!.status).toBe("expired");
    if (waitlist.ok) {
      const { data: entry } = await admin.from("waitlist_entries").select("status, removed_reason").eq("id", waitlist.waitlistEntryId).single();
      expect(entry).toMatchObject({ status: "removed_by_student", removed_reason: "stay_change_expired" });
    }
  });

  it("job: no vence un aviso con pago en curso y, si venció, igual se resuelve desde la solicitud vinculada", async (ctx) => {
    if (!need(ctx)) return;
    const { data: intent, error } = await admin
      .from("stay_change_intents")
      .insert({ student_profile_id: studentProfileId, reservation_id: reservationId, current_residence_id: currentResidenceId, status: "open", expires_at: new Date(Date.now() - 3_600_000).toISOString(), created_by_user_id: studentUserId })
      .select("id")
      .single();
    expect(error?.message ?? null).toBeNull();
    const app = await createApplicationFromRoomType(admin, {
      studentProfileId,
      residenceId: targetResidenceId,
      roomTypeId: fullTypeB,
      roomType: { monthly_price_usd: 300 },
      desiredStartDate: addMonthsIso(resStart, 1),
      durationMonths: 3,
      academicObjective: "Objetivo académico de prueba (test de integración).",
      initiatedBy: "student",
      contactTarget: "student",
      familyLinkId: null,
      familyProposalId: null,
      createdByUserId: studentUserId,
      actorRole: "student",
      stayChangeIntentId: intent!.id,
    });
    if (!("id" in app)) throw new Error(app.error);
    await admin.from("application_requests").update({ status: "residence_payment_pending" }).eq("id", app.id);
    await expireStayChangeIntents(admin);
    const { data: still } = await admin.from("stay_change_intents").select("status").eq("id", intent!.id).single();
    expect(still!.status).toBe("open"); // con pago en curso no vence

    await admin.from("stay_change_intents").update({ status: "expired" }).eq("id", intent!.id);
    const { data: otherRes } = await admin.from("reservations").select("id").neq("id", reservationId).limit(1).single();
    const resolved = await resolveStayChangeIntentOnReservation(admin, {
      studentProfileId,
      newReservationId: otherRes!.id as string,
      newResidenceId: targetResidenceId,
      newStartDate: addMonthsIso(todayAr, 2),
      newApplicationId: app.id,
    });
    expect(resolved).toBe(intent!.id);
    const { data: row } = await admin.from("stay_change_intents").select("status").eq("id", intent!.id).single();
    expect(row!.status).toBe("resolved_new_reservation");
  });

  it("salida anticipada: la registra la residencia con depósito devuelto/no, deja la reserva finalizada y el estudiante agrega su nota", async (ctx) => {
    if (!need(ctx)) return;
    const { data: stay, error } = await admin
      .from("resident_stays")
      .insert({ student_profile_id: studentProfileId, residence_id: currentResidenceId, room_type_id: roomTypeA, reservation_id: reservationId, invite_email: "valentina.sosa@example.com", status: "active", start_date: resStart, expected_end_date: resEnd })
      .select("id")
      .single();
    expect(error?.message ?? null).toBeNull();

    // Con depósito (300) hay que decir si se devolvió; un usuario ajeno a la residencia no puede cerrar.
    const missing = await endResidentStay(admin, { actorUserId: ownerId, residentStayId: stay!.id, endDate: null, earlyExit: { exitDate: todayAr, depositStatus: undefined, residenceNote: null } });
    expect(missing.ok).toBe(false);
    const outsider = await endResidentStay(admin, { actorUserId: adminActorId, residentStayId: stay!.id, endDate: null, earlyExit: { exitDate: todayAr, depositStatus: "returned", residenceNote: null } });
    expect(outsider.ok).toBe(false);

    const done = await endResidentStay(admin, {
      actorUserId: ownerId,
      residentStayId: stay!.id,
      endDate: null,
      earlyExit: { exitDate: todayAr, depositStatus: "not_returned", residenceNote: "No se cumplió la estadía mínima; se retiene el depósito según lo acordado." },
    });
    expect(done.ok).toBe(true);
    const { data: exit } = await admin.from("stay_early_exits").select("*").eq("resident_stay_id", stay!.id).single();
    expect(exit).toMatchObject({ exit_type: "early_exit", deposit_status: "not_returned", exit_date: todayAr });
    expect(Number(exit!.deposit_usd)).toBe(300);
    const { data: res } = await admin.from("reservations").select("status").eq("id", reservationId).single();
    expect(res!.status).toBe("completed");
    const { data: stayAfter } = await admin.from("resident_stays").select("status, is_current, end_date").eq("id", stay!.id).single();
    expect(stayAfter).toMatchObject({ status: "inactive", is_current: false, end_date: todayAr });
    const { data: exitNotes } = await admin.from("notifications").select("body").eq("user_id", studentUserId).eq("related_entity_type", "stay_early_exits").gte("created_at", startedAt);
    expect(exitNotes!.some((n) => n.body.includes(UNPAID_DISCLAIMER) && n.body.includes("Depósito no devuelto"))).toBe(true);

    expect((await saveStudentExitNote(admin, { actorUserId: studentUserId, residentStayId: stay!.id, note: "Me retiré en buenos términos." })).ok).toBe(true);
    expect((await saveStudentExitNote(admin, { actorUserId: familyUserId, residentStayId: stay!.id, note: "no debería" })).ok).toBe(false);
    const { data: withNote } = await admin.from("stay_early_exits").select("student_note").eq("resident_stay_id", stay!.id).single();
    expect(withNote!.student_note).toBe("Me retiré en buenos términos.");
  });
});
