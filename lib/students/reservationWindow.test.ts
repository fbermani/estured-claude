import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { addMonthsIso } from "@/lib/students/contractEnd";
import {
  checkReservationWindowOverlap,
  describeReservationWindow,
  loadReservationWindow,
  mergeReservationPeriods,
  minRequestStartDate,
  overlapsReservationWindow,
  reservationWindowMessage,
  type ReservationWindow,
} from "@/lib/students/reservationWindow";
import { joinWaitlist } from "@/lib/waitlist-entries/joinWaitlist";
import { removeWaitlistEntriesOnConfirmedReservation } from "@/lib/waitlist-entries/removeWaitlistEntriesOnConfirmedReservation";
import { notificationHref } from "@/lib/notifications/links";

const WINDOW: ReservationWindow = { startDate: "2026-07-20", endDate: "2027-01-20" };

describe("overlapsReservationWindow (puro)", () => {
  it("sin ventana nunca se superpone", () => {
    expect(overlapsReservationWindow(null, "2026-09-01", 6)).toBe(false);
  });
  it("ingreso dentro del período: se superpone", () => {
    expect(overlapsReservationWindow(WINDOW, "2026-09-01", 3)).toBe(true);
    expect(overlapsReservationWindow(WINDOW, "2026-07-20", 1)).toBe(true);
    expect(overlapsReservationWindow(WINDOW, "2027-01-19", 1)).toBe(true);
  });
  it("el fin es exclusivo: ingresar el día del fin o después NO se superpone", () => {
    expect(overlapsReservationWindow(WINDOW, "2027-01-20", 6)).toBe(false);
    expect(overlapsReservationWindow(WINDOW, "2027-02-01", 6)).toBe(false);
  });
  it("pedido que empieza antes pero llega a pisar el período: se superpone; si termina justo al inicio, no", () => {
    expect(overlapsReservationWindow(WINDOW, "2026-06-01", 2)).toBe(true); // 1/6 -> 1/8
    expect(overlapsReservationWindow(WINDOW, "2026-04-20", 3)).toBe(false); // 20/4 -> 20/7 (justo el inicio)
    expect(overlapsReservationWindow(WINDOW, "2026-04-21", 3)).toBe(true);
  });
  it("meses calendario con recorte de fin de mes (31 ene + 1 mes = 28 feb)", () => {
    const w: ReservationWindow = { startDate: "2027-02-28", endDate: "2027-08-28" };
    expect(overlapsReservationWindow(w, "2027-01-31", 1)).toBe(false); // 31/1 -> 28/2 (exclusivo)
    expect(overlapsReservationWindow(w, "2027-01-31", 2)).toBe(true);
  });
  it("duración inválida se toma como 1 mes; fecha inválida no se considera superposición", () => {
    expect(overlapsReservationWindow(WINDOW, "2026-09-01", 0)).toBe(true);
    expect(overlapsReservationWindow(WINDOW, "2026-09-01", null)).toBe(true);
    expect(overlapsReservationWindow(WINDOW, "no-fecha", 3)).toBe(false);
  });
});

describe("textos y fecha mínima (puro)", () => {
  it("fecha mínima = fin del período; sin ventana, null", () => {
    expect(minRequestStartDate(WINDOW)).toBe("2027-01-20");
    expect(minRequestStartDate(null)).toBeNull();
  });
  it("mensajes en voseo, fecha DD/MM/AAAA sin correr el día", () => {
    expect(reservationWindowMessage(WINDOW)).toBe("Ya tenés una reserva hasta 20/01/2027. Podés enviar tu solicitud de reserva para fechas posteriores.");
    expect(reservationWindowMessage(WINDOW, "family")).toBe(
      "Este estudiante ya tiene una reserva hasta 20/01/2027. Podés proponer para fechas posteriores.",
    );
  });
  it("describeReservationWindow para el panel de la ficha", () => {
    expect(describeReservationWindow(null)).toBeNull();
    expect(describeReservationWindow(WINDOW)).toEqual({
      minRequestStartDate: "2027-01-20",
      message: "Ya tenés una reserva hasta 20/01/2027. Podés enviar tu solicitud de reserva para fechas posteriores.",
      endDateLabel: "20/01/2027",
      stayChangeOpen: false,
    });
  });
  it("mergeReservationPeriods: descarta períodos terminados y funde el resto", () => {
    const now = new Date("2026-10-23T15:00:00Z");
    expect(mergeReservationPeriods([{ startDate: "2026-02-01", endDate: "2026-08-01" }], now)).toBeNull();
    expect(
      mergeReservationPeriods(
        [
          { startDate: "2026-02-01", endDate: "2026-08-01" },
          { startDate: "2026-09-01", endDate: "2027-03-01" },
          { startDate: "2026-12-01", endDate: "2027-06-01" },
        ],
        now,
      ),
    ).toEqual({ startDate: "2026-09-01", endDate: "2027-06-01" });
  });
});

describe("notificationHref: student_favorites", () => {
  it("lleva a /students/favorites, con o sin id", () => {
    expect(notificationHref({ entityType: "student_favorites", entityId: null, area: "student" })).toBe("/students/favorites");
  });
});

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("reserva vigente: superposición, lista de espera y favoritos (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let otherRoomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  const todayAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const resStart = addMonthsIso(todayAr, 0); // la reserva ya empezó hoy
  const resEnd = addMonthsIso(resStart, 6);
  const afterEnd = addMonthsIso(resEnd, 1);
  let reservationId: string;

  async function createReservation(status: string, startDate: string, months: number): Promise<string> {
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
        exchange_rate_date: todayAr,
        initial_duration_months: months,
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
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status: "converted_to_reservation",
        desired_start_date: startDate,
        initial_duration_months: months,
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
        residence_id: residenceId,
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
        residence_id: residenceId,
        room_type_id: roomTypeId,
        status,
        start_date: startDate,
        initial_duration_months: months,
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

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    // Valentina Sosa: estudiante demo sin reservas ni solicitudes (Lucía ya tiene una reserva confirmada demo).
    const { data: studentUser } = await admin.from("users").select("id").eq("email", "valentina.sosa@example.com").single();
    studentUserId = studentUser!.id;
    const { data: studentProfile } = await admin.from("student_profiles").select("id").eq("user_id", studentUserId).single();
    studentProfileId = studentProfile!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 58 — ventana de reserva)",
        slug: `residencia-test-ventana-reserva-${Date.now()}`,
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
    const { error: ruError } = await admin
      .from("residence_users")
      .insert({ residence_id: residenceId, user_id: ownerId, role: "owner", is_active: true });
    if (ruError) {
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(`No se pudo dar acceso al owner demo: ${ruError.message}`);
    }
    const types: string[] = [];
    for (const [name, status] of [["Individual", "full"], ["Doble", "available_to_confirm"]] as const) {
      const { data: rt } = await admin
        .from("room_types")
        .insert({ residence_id: residenceId, name, monthly_price_usd: 300, monthly_price_ars: 456000 })
        .select("id")
        .single();
      await admin.from("profile_availability").insert({
        residence_id: residenceId,
        room_type_id: rt!.id,
        status,
        available_count: status === "full" ? 0 : 2,
        last_confirmed_by: ownerId,
      });
      types.push(rt!.id);
    }
    [roomTypeId, otherRoomTypeId] = types;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin
      .from("notifications")
      .delete()
      .eq("user_id", studentUserId)
      .eq("related_entity_type", "student_favorites");
    await deleteResidenceCascade(admin, residenceId); // borra también favoritos (on delete cascade) y reservas.
  });

  it("sin reservas: no hay ventana y todo está permitido", async () => {
    const { window, failed } = await loadReservationWindow(admin, studentProfileId);
    expect(failed).toBe(false);
    expect(window).toBeNull();
    expect(
      (await checkReservationWindowOverlap(admin, { studentProfileId, residenceId, desiredStartDate: resStart, durationMonths: 6 })).ok,
    ).toBe(true);
  });

  it("reserva confirmada vigente: bloquea fechas superpuestas y permite las posteriores", async () => {
    reservationId = await createReservation("confirmed", resStart, 6);

    const { window } = await loadReservationWindow(admin, studentProfileId);
    expect(window).toEqual({ startDate: resStart, endDate: resEnd });

    const blocked = await checkReservationWindowOverlap(admin, {
      studentProfileId, residenceId,
      desiredStartDate: addMonthsIso(resStart, 2),
      durationMonths: 3,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/^Ya tenés una reserva hasta \d{2}\/\d{2}\/\d{4}\. Podés enviar tu solicitud de reserva para fechas posteriores\.$/);

    // El mismo día del fin del período ya se puede.
    expect(
      (await checkReservationWindowOverlap(admin, { studentProfileId, residenceId, desiredStartDate: resEnd, durationMonths: 6 })).ok,
    ).toBe(true);
    expect(
      (await checkReservationWindowOverlap(admin, { studentProfileId, residenceId, desiredStartDate: afterEnd, durationMonths: 6 })).ok,
    ).toBe(true);

    const family = await checkReservationWindowOverlap(admin, {
      studentProfileId, residenceId,
      desiredStartDate: resStart,
      durationMonths: 2,
      audience: "family",
    });
    expect(family.ok).toBe(false);
    if (!family.ok) expect(family.error).toMatch(/^Este estudiante ya tiene una reserva hasta/);
  });

  it("una renovación confirmada extiende el período bloqueado", async () => {
    const renewedEnd = addMonthsIso(resEnd, 3);
    const { data: offer, error } = await admin
      .from("renewal_offers")
      .insert({
        reservation_id: reservationId,
        student_profile_id: studentProfileId,
        residence_id: residenceId,
        status: "confirmed",
        period_start_date: resEnd,
        period_end_date: renewedEnd,
        duration_months: 3,
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        adjustment_policy: "quarterly",
        fee_base_usd: 900,
        fee_base_ars: 1368000,
        estimated_estured_fee_ars: 100000,
        acceptance_deadline_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    // Si el esquema de renovaciones pide más columnas, el test lo dice en voz alta en vez de pasar en falso.
    expect(error?.message ?? null).toBeNull();
    const { window } = await loadReservationWindow(admin, studentProfileId);
    expect(window?.endDate).toBe(renewedEnd);
    expect(
      (await checkReservationWindowOverlap(admin, { studentProfileId, residenceId, desiredStartDate: afterEnd, durationMonths: 2 })).ok,
    ).toBe(false);
    await admin.from("renewal_offers").delete().eq("id", offer!.id);
  });

  it("joinWaitlist: respeta la ventana (con y sin fecha) y deja anotarse para fechas posteriores", async () => {
    const overlapping = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: addMonthsIso(resStart, 1),
      desiredDurationMonths: 3,
    });
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) expect(overlapping.error).toMatch(/Ya tenés una reserva hasta/);

    const noDate = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(noDate.ok).toBe(false);

    const later = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: afterEnd,
      desiredDurationMonths: 6,
    });
    expect(later.ok).toBe(true);
    if (later.ok) await admin.from("waitlist_entries").delete().eq("id", later.waitlistEntryId);
  });

  it("al confirmarse la reserva se anulan las listas de espera, se notifica y quedan en favoritos (sin duplicar)", async () => {
    // Otros tests (waitlist.test.ts) usan a la misma estudiante y pueden dejar avisos del mismo tipo.
    await admin.from("notifications").delete().eq("user_id", studentUserId).eq("related_entity_type", "student_favorites");
    // Pasa a no vigente para poder anotarse sin la regla, como antes de confirmar.
    await admin.from("reservations").update({ status: "pending_estured_fee" }).eq("id", reservationId);
    await admin.from("reservations").update({ status: "cancelled_by_student" }).eq("id", reservationId);
    expect((await loadReservationWindow(admin, studentProfileId)).window).toBeNull();

    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: afterEnd,
      desiredDurationMonths: 6,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    // Ya era favorita de antes: no se duplica ni se pisa quién la agregó.
    await admin.from("student_favorites").insert({
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      added_by_role: "student",
      added_by_user_id: studentUserId,
    });

    const removed = await removeWaitlistEntriesOnConfirmedReservation(admin, { studentProfileId });
    expect(removed.map((r) => r.id)).toEqual([joined.waitlistEntryId]);

    const { data: entry } = await admin.from("waitlist_entries").select("status").eq("id", joined.waitlistEntryId).single();
    expect(entry!.status).toBe("removed_due_to_confirmed_reservation");

    const { data: favorites } = await admin
      .from("student_favorites")
      .select("id")
      .eq("student_profile_id", studentProfileId)
      .eq("residence_id", residenceId);
    expect(favorites).toHaveLength(1);

    const { data: notifications } = await admin
      .from("notifications")
      .select("title, body, related_entity_type")
      .eq("user_id", studentUserId)
      .eq("related_entity_type", "student_favorites");
    expect(notifications).toHaveLength(1);
    expect(notifications![0].body).toContain("Residencia Test Integración (Ciclo 58");
    expect(notifications![0].body).toMatch(/confirmaste una reserva/);
    expect(notifications![0].body).toMatch(/favoritos/);

    // Sin entradas activas no hay aviso ni cambios.
    expect(await removeWaitlistEntriesOnConfirmedReservation(admin, { studentProfileId })).toEqual([]);
    const { data: still } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", studentUserId)
      .eq("related_entity_type", "student_favorites");
    expect(still).toHaveLength(1);

    // Y si la residencia no era favorita, la agrega.
    await admin.from("student_favorites").delete().eq("student_profile_id", studentProfileId).eq("residence_id", residenceId);
    const again = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: afterEnd,
      desiredDurationMonths: 6,
    });
    expect(again.ok).toBe(true);
    await removeWaitlistEntriesOnConfirmedReservation(admin, { studentProfileId });
    const { data: added } = await admin
      .from("student_favorites")
      .select("added_by_role")
      .eq("student_profile_id", studentProfileId)
      .eq("residence_id", residenceId);
    expect(added).toHaveLength(1);
  });

  it("joinWaitlist: valida el tipo (de la residencia, activo, completo, no pausado) y la unicidad por tipo", async () => {
    const base = { actorUserId: studentUserId, residenceId, desiredStartDate: afterEnd, desiredDurationMonths: 6 };

    const foreign = await joinWaitlist(admin, { ...base, roomTypeId: "00000000-0000-4000-8000-000000000000" });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error).toMatch(/ya no está disponible/);

    // "Doble" tiene lugar: se solicita directo, no se anota en lista de espera.
    const available = await joinWaitlist(admin, { ...base, roomTypeId: otherRoomTypeId });
    expect(available.ok).toBe(false);
    if (!available.ok) expect(available.error).toMatch(/no está completo/);

    await admin.from("profile_availability").update({ status: "paused_by_residence" }).eq("room_type_id", otherRoomTypeId);
    const paused = await joinWaitlist(admin, { ...base, roomTypeId: otherRoomTypeId });
    expect(paused.ok).toBe(false);
    if (!paused.ok) expect(paused.error).toMatch(/pausadas/);

    // Una entrada por tipo: el tipo completo y "cualquier tipo" conviven; repetir el mismo tipo no.
    const typed = await joinWaitlist(admin, { ...base, roomTypeId });
    expect(typed.ok).toBe(true);
    const anyType = await joinWaitlist(admin, { ...base, roomTypeId: null });
    expect(anyType.ok).toBe(true);
    const dupTyped = await joinWaitlist(admin, { ...base, roomTypeId });
    expect(dupTyped.ok).toBe(false);
    if (!dupTyped.ok) expect(dupTyped.error).toMatch(/Ya estás/);
    const dupAny = await joinWaitlist(admin, { ...base, roomTypeId: null });
    expect(dupAny.ok).toBe(false);

    await admin.from("waitlist_entries").delete().eq("residence_id", residenceId).eq("student_profile_id", studentProfileId);
  });

  it("estadía terminada (inactive) o reserva no vigente no bloquean", async () => {
    await admin.from("reservations").update({ status: "confirmed" }).eq("id", reservationId);
    expect((await loadReservationWindow(admin, studentProfileId)).window).not.toBeNull();

    await admin.from("resident_stays").insert({
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      room_type_id: roomTypeId,
      reservation_id: reservationId,
      status: "inactive",
      is_current: false,
      start_date: resStart,
    });
    expect((await loadReservationWindow(admin, studentProfileId)).window).toBeNull();
  });
});
