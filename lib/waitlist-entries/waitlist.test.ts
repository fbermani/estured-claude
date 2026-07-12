import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { joinWaitlist } from "@/lib/waitlist-entries/joinWaitlist";
import { leaveWaitlist } from "@/lib/waitlist-entries/leaveWaitlist";
import { stayInWaitlist } from "@/lib/waitlist-entries/stayInWaitlist";
import { notifyWaitlistAvailability } from "@/lib/waitlist-entries/notifyWaitlistAvailability";
import { removeFromWaitlistByResidence } from "@/lib/waitlist-entries/removeFromWaitlistByResidence";
import { activateFromWaitlist } from "@/lib/waitlist-entries/activateFromWaitlist";
import { removeWaitlistEntriesOnConfirmedReservation } from "@/lib/waitlist-entries/removeWaitlistEntriesOnConfirmedReservation";
import { updateAvailability } from "@/lib/availability/updateAvailability";
import { checkStaleAvailability } from "@/lib/jobs/checkStaleAvailability";
import { notifyWaitlistKeepAlive } from "@/lib/jobs/notifyWaitlistKeepAlive";

/**
 * Fase 5.1 — disponibilidad (Modo Perfil Verificado) + lista de espera
 * por residencia. Mismo patrón de fixtures que `renewals.test.ts`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("disponibilidad y lista de espera (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let roomTypeId: string;
  let ownerId: string;
  let studentUserId: string;
  let studentProfileId: string;

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
        name: "Residencia Test Integración (Ciclo 31 — disponibilidad)",
        slug: `residencia-test-availability-${Date.now()}`,
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
      // Si no se pudo dar acceso, la residencia recién creada queda huérfana
      // para siempre — Vitest NO corre `afterAll` cuando `beforeAll` lanza.
      // Limpiar acá mismo antes de relanzar (Ciclo 32bis).
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(
        `No se pudo dar acceso al owner demo a la residencia de test (¿llegó al límite de 10 residencias activas? revisar residencias de prueba huérfanas): ${residenceUsersError.message}`,
      );
    }

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

    await admin.from("profile_availability").insert({
      residence_id: residenceId,
      room_type_id: roomTypeId,
      status: "full",
      available_count: 0,
      last_confirmed_by: ownerId,
    });
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("waitlist_entries").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("joinWaitlist: el estudiante se suma y no puede duplicarse", async () => {
    const first = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: "2026-09-01",
      desiredDurationMonths: 6,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/ya estás/i);

    await leaveWaitlist(admin, { waitlistEntryId: first.waitlistEntryId, actorUserId: studentUserId });
  });

  it("notifyWaitlistAvailability + stayInWaitlist: flujo completo del aviso", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const notified = await notifyWaitlistAvailability(admin, {
      waitlistEntryId: joined.waitlistEntryId,
      actorUserId: ownerId,
    });
    expect(notified.ok).toBe(true);

    const { data: afterNotify } = await admin
      .from("waitlist_entries")
      .select("status")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(afterNotify!.status).toBe("availability_notification_sent");

    const stayed = await stayInWaitlist(admin, { waitlistEntryId: joined.waitlistEntryId, actorUserId: studentUserId });
    expect(stayed.ok).toBe(true);

    const { data: afterStay } = await admin
      .from("waitlist_entries")
      .select("status")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(afterStay!.status).toBe("active");

    await leaveWaitlist(admin, { waitlistEntryId: joined.waitlistEntryId, actorUserId: studentUserId });
  });

  it("notifyWaitlistAvailability: rechaza si el actor no tiene acceso a la residencia", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const result = await notifyWaitlistAvailability(admin, {
      waitlistEntryId: joined.waitlistEntryId,
      actorUserId: studentUserId, // el estudiante no es owner/staff
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no tenés acceso/i);

    await leaveWaitlist(admin, { waitlistEntryId: joined.waitlistEntryId, actorUserId: studentUserId });
  });

  it("removeFromWaitlistByResidence: la residencia saca a un estudiante", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const removed = await removeFromWaitlistByResidence(admin, {
      waitlistEntryId: joined.waitlistEntryId,
      actorUserId: ownerId,
      reason: "Se dio de baja el tipo de habitación.",
    });
    expect(removed.ok).toBe(true);

    const { data: afterRemove } = await admin
      .from("waitlist_entries")
      .select("status, removed_reason")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(afterRemove!.status).toBe("removed_by_residence");
    expect(afterRemove!.removed_reason).toBe("Se dio de baja el tipo de habitación.");
  });

  it("activateFromWaitlist: rechaza si la entrada no eligió tipo de habitación", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const result = await activateFromWaitlist(admin, {
      waitlistEntryId: joined.waitlistEntryId,
      actorUserId: studentUserId,
      desiredStartDate: "2026-09-01",
      durationMonths: 6,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/tipo de habitación/i);

    await leaveWaitlist(admin, { waitlistEntryId: joined.waitlistEntryId, actorUserId: studentUserId });
  });

  it("activateFromWaitlist: crea una solicitud real cuando hay tipo de habitación elegido", async () => {
    await admin.from("profile_availability").update({ status: "available_to_confirm" }).eq("room_type_id", roomTypeId);

    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const activated = await activateFromWaitlist(admin, {
      waitlistEntryId: joined.waitlistEntryId,
      actorUserId: studentUserId,
      desiredStartDate: "2026-09-01",
      durationMonths: 6,
    });
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;

    const { data: entryAfter } = await admin
      .from("waitlist_entries")
      .select("status")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(entryAfter!.status).toBe("student_activated_request");

    await admin.from("application_requests").delete().eq("id", activated.applicationId);
    await admin.from("profile_availability").update({ status: "full" }).eq("room_type_id", roomTypeId);
  });

  it("updateAvailability: la residencia actualiza y limpia hidden_from_search_at", async () => {
    await admin
      .from("profile_availability")
      .update({ hidden_from_search_at: new Date().toISOString(), status: "not_updated" })
      .eq("room_type_id", roomTypeId);

    const result = await updateAvailability(admin, {
      roomTypeId,
      actorUserId: ownerId,
      status: "available_to_confirm",
      availableCount: 2,
      availableFrom: null,
      notesPublic: "Lugar disponible desde ya.",
    });
    expect(result.ok).toBe(true);

    const { data: after } = await admin
      .from("profile_availability")
      .select("status, available_count, hidden_from_search_at")
      .eq("room_type_id", roomTypeId)
      .single();
    expect(after!.status).toBe("available_to_confirm");
    expect(after!.available_count).toBe(2);
    expect(after!.hidden_from_search_at).toBeNull();

    await admin.from("profile_availability").update({ status: "full" }).eq("room_type_id", roomTypeId);
  });

  it("checkStaleAvailability: marca not_updated a los 30 días y oculta a los 45", async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 3_600_000).toISOString();
    await admin
      .from("profile_availability")
      .update({ status: "available_to_confirm", last_confirmed_at: thirtyOneDaysAgo, hidden_from_search_at: null })
      .eq("room_type_id", roomTypeId);

    const result = await checkStaleAvailability(admin);
    expect(result.markedStale).toBeGreaterThanOrEqual(1);

    const { data: afterStale } = await admin
      .from("profile_availability")
      .select("status")
      .eq("room_type_id", roomTypeId)
      .single();
    expect(afterStale!.status).toBe("not_updated");

    const fortySixDaysAgo = new Date(Date.now() - 46 * 24 * 3_600_000).toISOString();
    await admin.from("profile_availability").update({ last_confirmed_at: fortySixDaysAgo }).eq("room_type_id", roomTypeId);

    const secondRun = await checkStaleAvailability(admin);
    expect(secondRun.hiddenCount).toBeGreaterThanOrEqual(1);

    const { data: afterHidden } = await admin
      .from("profile_availability")
      .select("hidden_from_search_at")
      .eq("room_type_id", roomTypeId)
      .single();
    expect(afterHidden!.hidden_from_search_at).not.toBeNull();

    await admin
      .from("profile_availability")
      .update({ status: "full", last_confirmed_at: new Date().toISOString(), hidden_from_search_at: null })
      .eq("room_type_id", roomTypeId);
  });

  it("notifyWaitlistKeepAlive: marca retention_check_sent a los 90 días", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 3_600_000).toISOString();
    await admin.from("waitlist_entries").update({ joined_at: ninetyOneDaysAgo }).eq("id", joined.waitlistEntryId);

    const result = await notifyWaitlistKeepAlive(admin);
    expect(result.notifiedCount).toBeGreaterThanOrEqual(1);

    const { data: after } = await admin
      .from("waitlist_entries")
      .select("status, last_keep_alive_notified_at")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(after!.status).toBe("retention_check_sent");
    expect(after!.last_keep_alive_notified_at).not.toBeNull();

    await leaveWaitlist(admin, { waitlistEntryId: joined.waitlistEntryId, actorUserId: studentUserId });
  });

  it("removeWaitlistEntriesOnConfirmedReservation: saca al estudiante de sus listas activas", async () => {
    const joined = await joinWaitlist(admin, {
      actorUserId: studentUserId,
      residenceId,
      roomTypeId: null,
      desiredStartDate: null,
      desiredDurationMonths: null,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    await removeWaitlistEntriesOnConfirmedReservation(admin, { studentProfileId });

    const { data: after } = await admin
      .from("waitlist_entries")
      .select("status")
      .eq("id", joined.waitlistEntryId)
      .single();
    expect(after!.status).toBe("removed_due_to_confirmed_reservation");
  });
});
