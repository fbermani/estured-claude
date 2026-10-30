import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { activateResidentStay } from "@/lib/residents/activateResidentStay";
import { setResidentVisibility } from "@/lib/residents/setResidentVisibility";
import { endResidentStay } from "@/lib/residents/endResidentStay";
import { extendResidentStayOnRenewal } from "@/lib/residents/extendResidentStayOnRenewal";
import { findLinkableReservationId, linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";

/**
 * Docs/05 §15, docs/06 §15.1 — residentes + comunidad visible (Ciclo
 * 33bis, Fase 5.3 acotada por tipo de habitación, ver MEMORY.md). Mismo
 * patrón de fixtures que `roomTypeQueue.test.ts`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("resident_stays (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;
  let studentEmail: string;
  let someRealReservationId: string | null;
  const residentStayIds: string[] = [];

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
      .select("id, email")
      .eq("email", "lucia.fernandez@example.com")
      .single();
    studentUserId = studentUser!.id;
    studentEmail = studentUser!.email!;

    const { data: studentProfile } = await admin
      .from("student_profiles")
      .select("id")
      .eq("user_id", studentUserId)
      .single();
    studentProfileId = studentProfile!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 33bis — residentes)",
        slug: `residencia-test-residentes-${Date.now()}`,
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

    const { error: residenceUsersError } = await admin.from("residence_users").insert({
      residence_id: residenceId,
      user_id: ownerId,
      role: "owner",
      is_active: true,
    });
    if (residenceUsersError) {
      // Gotcha #35: Vitest no corre afterAll si beforeAll lanza.
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

    // Referencia de solo lectura a una reserva real ya existente (no se
    // modifica) — resident_stays.reservation_id tiene FK real a
    // reservations, no se puede insertar un uuid arbitrario. Tiene que
    // ser una reserva que TODAVÍA no tenga una resident_stays real del
    // seed apuntándola (scripts/seed-demo-data.mjs ya crea una para la
    // reserva confirmada de Lucía) — si no, el insert de acá abajo crea
    // una segunda fila con el mismo reservation_id y `.maybeSingle()` en
    // `extendResidentStayOnRenewal` queda ambigua (silenciosamente no
    // hace nada, que es el comportamiento correcto de la función ante
    // datos ambiguos, pero rompe este test si no se evita el choque).
    const { data: usedReservationIds } = await admin
      .from("resident_stays")
      .select("reservation_id")
      .not("reservation_id", "is", null);
    const usedIds = new Set((usedReservationIds ?? []).map((r) => r.reservation_id));
    const { data: candidateReservations } = await admin.from("reservations").select("id").limit(20);
    someRealReservationId = (candidateReservations ?? []).find((r) => !usedIds.has(r.id))?.id ?? null;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin.from("resident_stays").delete().eq("residence_id", residenceId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    await deleteResidenceCascade(admin, residenceId);
  });

  it("createResidentStay: rechaza si el actor no tiene acceso a la residencia", async () => {
    const result = await createResidentStay(admin, {
      actorUserId: studentUserId,
      residenceId,
      inviteEmail: "nuevo.residente@example.com",
      roomTypeId,
      reservationId: null,
      startDate: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no tenés acceso/i);
  });

  it("createResidentStay: rechaza un email inválido", async () => {
    const result = await createResidentStay(admin, {
      actorUserId: ownerId,
      residenceId,
      inviteEmail: "no-es-un-email",
      roomTypeId,
      reservationId: null,
      startDate: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email válido/i);
  });

  it("createResidentStay: crea la estadía pendiente de activación", async () => {
    const result = await createResidentStay(admin, {
      actorUserId: ownerId,
      residenceId,
      inviteEmail: studentEmail.toUpperCase(),
      roomTypeId,
      reservationId: null,
      startDate: "2026-08-01",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    residentStayIds.push(result.residentStayId);

    const { data: stay } = await admin
      .from("resident_stays")
      .select("status, invite_email, student_profile_id")
      .eq("id", result.residentStayId)
      .single();
    expect(stay!.status).toBe("pending_activation");
    expect(stay!.invite_email).toBe(studentEmail.toLowerCase());
    expect(stay!.student_profile_id).toBeNull();
  });

  it("createResidentStay: no vincula reservas de OTRA residencia (el estudiante tiene reserva, pero no acá)", async () => {
    const { data: stay } = await admin
      .from("resident_stays")
      .select("reservation_id")
      .eq("id", residentStayIds[0])
      .single();
    expect(stay!.reservation_id).toBeNull();
  });

  it("findLinkableReservationId: devuelve null si el estudiante no tiene reservas confirmadas en esa residencia", async () => {
    await expect(findLinkableReservationId(admin, { residenceId, studentProfileId })).resolves.toBeNull();
  });

  it("linkStayToReservationIfMissing: completa el vínculo con la reserva única confirmada y no pisa uno existente", async () => {
    // Usa la estadía real del seed (Lucía @ Río de la Plata, vinculada a su
    // reserva confirmada): se desvincula, se re-vincula y se restaura en
    // `finally` pase lo que pase.
    const { data: seeded } = await admin
      .from("resident_stays")
      .select("id, residence_id, student_profile_id, reservation_id")
      .eq("student_profile_id", studentProfileId)
      .eq("is_current", true)
      .not("reservation_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!seeded) return; // sin seed demo no hay fixture.

    try {
      await admin.from("resident_stays").update({ reservation_id: null }).eq("id", seeded.id);
      const linked = await linkStayToReservationIfMissing(admin, {
        residentStayId: seeded.id,
        residenceId: seeded.residence_id,
        studentProfileId,
      });
      expect(linked).toBe(seeded.reservation_id);

      // Ya vinculada: no la pisa ni devuelve nada.
      const again = await linkStayToReservationIfMissing(admin, {
        residentStayId: seeded.id,
        residenceId: seeded.residence_id,
        studentProfileId,
      });
      expect(again).toBeNull();
    } finally {
      await admin.from("resident_stays").update({ reservation_id: seeded.reservation_id }).eq("id", seeded.id);
    }
  });

  it("createResidentStay: rechaza un duplicado activo para el mismo email", async () => {
    const result = await createResidentStay(admin, {
      actorUserId: ownerId,
      residenceId,
      inviteEmail: studentEmail,
      roomTypeId,
      reservationId: null,
      startDate: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ya hay una estadía/i);
  });

  it("activateResidentStay: rechaza si el email no coincide con el actor", async () => {
    const result = await activateResidentStay(admin, { actorUserId: ownerId, residentStayId: residentStayIds[0] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/perfil de estudiante|no corresponde/i);
  });

  it("activateResidentStay: vincula la cuenta y pasa a active", async () => {
    const result = await activateResidentStay(admin, { actorUserId: studentUserId, residentStayId: residentStayIds[0] });
    expect(result.ok).toBe(true);

    const { data: stay } = await admin
      .from("resident_stays")
      .select("status, student_profile_id")
      .eq("id", residentStayIds[0])
      .single();
    expect(stay!.status).toBe("active");
    expect(stay!.student_profile_id).toBe(studentProfileId);
  });

  it("activateResidentStay: rechaza reactivar una estadía ya activada", async () => {
    const result = await activateResidentStay(admin, { actorUserId: studentUserId, residentStayId: residentStayIds[0] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ya fue activada/i);
  });

  it("setResidentVisibility: rechaza si la estadía no pertenece al actor", async () => {
    const result = await setResidentVisibility(admin, {
      actorUserId: ownerId, // dueño de residencia, no tiene student_profile
      residentStayId: residentStayIds[0],
      hidden: true,
    });
    expect(result.ok).toBe(false);
  });

  it("setResidentVisibility: el estudiante se oculta y se vuelve a mostrar", async () => {
    const hide = await setResidentVisibility(admin, {
      actorUserId: studentUserId,
      residentStayId: residentStayIds[0],
      hidden: true,
    });
    expect(hide.ok).toBe(true);
    const { data: hidden } = await admin.from("resident_stays").select("status").eq("id", residentStayIds[0]).single();
    expect(hidden!.status).toBe("hidden_by_user");

    const show = await setResidentVisibility(admin, {
      actorUserId: studentUserId,
      residentStayId: residentStayIds[0],
      hidden: false,
    });
    expect(show.ok).toBe(true);
    const { data: shown } = await admin.from("resident_stays").select("status").eq("id", residentStayIds[0]).single();
    expect(shown!.status).toBe("active");
  });

  it("endResidentStay: cierra la estadía", async () => {
    const result = await endResidentStay(admin, { actorUserId: ownerId, residentStayId: residentStayIds[0], endDate: null });
    expect(result.ok).toBe(true);

    const { data: stay } = await admin
      .from("resident_stays")
      .select("status, is_current, end_date")
      .eq("id", residentStayIds[0])
      .single();
    expect(stay!.status).toBe("inactive");
    expect(stay!.is_current).toBe(false);
    expect(stay!.end_date).not.toBeNull();
  });

  it("endResidentStay: rechaza cerrar una estadía ya cerrada", async () => {
    const result = await endResidentStay(admin, { actorUserId: ownerId, residentStayId: residentStayIds[0], endDate: null });
    expect(result.ok).toBe(false);
  });

  it("extendResidentStayOnRenewal: no hace nada si no hay resident_stays vinculada (nunca lanza)", async () => {
    await expect(
      extendResidentStayOnRenewal(admin, { reservationId: "00000000-0000-0000-0000-000000000000", newEndDate: "2027-01-01" }),
    ).resolves.toBeUndefined();
  });

  it("extendResidentStayOnRenewal: extiende expected_end_date (Contrato hasta) y no toca end_date (salida real)", async () => {
    if (!someRealReservationId) return; // sin reservas reales en el dataset, no se puede armar el fixture.

    const { data: stay } = await admin
      .from("resident_stays")
      .insert({
        residence_id: residenceId,
        room_type_id: roomTypeId,
        reservation_id: someRealReservationId,
        status: "created_by_residence",
        is_current: true,
        invite_name: "Residente de prueba (test de integración)",
        expected_end_date: "2026-08-12",
      })
      .select("id")
      .single();
    residentStayIds.push(stay!.id);

    await extendResidentStayOnRenewal(admin, { reservationId: someRealReservationId, newEndDate: "2027-06-30" });

    const { data: updated } = await admin
      .from("resident_stays")
      .select("expected_end_date, end_date")
      .eq("id", stay!.id)
      .single();
    expect(updated!.expected_end_date).toBe("2027-06-30");
    expect(updated!.end_date).toBeNull();

    // Nunca acorta un contrato ya más largo.
    await extendResidentStayOnRenewal(admin, { reservationId: someRealReservationId, newEndDate: "2027-01-01" });
    const { data: again } = await admin.from("resident_stays").select("expected_end_date").eq("id", stay!.id).single();
    expect(again!.expected_end_date).toBe("2027-06-30");
  });
});
