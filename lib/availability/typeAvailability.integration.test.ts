import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { getCatalogResidences } from "@/lib/residences/catalog";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";

/**
 * D3 / H03 (Ciclo 55): la disponibilidad que ve el estudiante la manda el TIPO de habitación
 * (`profile_availability`); las camas libres de `rooms` son solo información. Fixture: una residencia con
 * un tipo "Doble" completo (pero con una habitación física con camas libres) y un "Triple" disponible.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("disponibilidad por tipo (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let slug: string;
  let dobleId: string;
  let tripleId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    slug = `residencia-test-disponibilidad-${Date.now()}`;
    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 55 — disponibilidad)",
        slug,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: owner!.id,
      })
      .select("id")
      .single();
    residenceId = residence!.id;

    try {
      const mk = async (name: string, usd: number, capacity: number, status: string) => {
        const { data: rt, error } = await admin
          .from("room_types")
          .insert({
            residence_id: residenceId,
            name,
            monthly_price_usd: usd,
            monthly_price_ars: usd * 1500,
            capacity_per_room: capacity,
            is_active: true,
          })
          .select("id")
          .single();
        if (error || !rt) throw new Error(`room_types: ${error?.message}`);
        const { error: avError } = await admin.from("profile_availability").insert({
          residence_id: residenceId,
          room_type_id: rt.id,
          status,
          available_count: status === "available_to_confirm" ? 2 : 0,
          last_confirmed_by: owner!.id,
        });
        if (avError) throw new Error(`profile_availability: ${avError.message}`);
        // Habitación física vacía: tiene camas libres aunque el tipo esté completo.
        const { error: roomError } = await admin
          .from("rooms")
          .insert({ residence_id: residenceId, room_type_id: rt.id, label: `${name} 1`, sort_order: 1, is_active: true });
        if (roomError) throw new Error(`rooms: ${roomError.message}`);
        return rt.id as string;
      };
      dobleId = await mk("Doble", 160, 2, "full");
      tripleId = await mk("Triple", 190, 3, "available_to_confirm");
    } catch (error) {
      // Gotcha: Vitest no corre afterAll si beforeAll lanza.
      await deleteResidenceCascade(admin, residenceId);
      throw error;
    }
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await deleteResidenceCascade(admin, residenceId);
  });

  it("el catálogo deriva el modo, los tipos ofrecidos y el precio 'desde' del tipo (sin contar el completo)", async () => {
    const catalog = await getCatalogResidences();
    const r = catalog.find((c) => c.slug === slug);
    expect(r).toBeDefined();
    expect(r!.availabilityMode).toBe("by_room_type_to_confirm");
    expect(r!.roomTypes.find((t) => t.type === "Doble")?.available).toBe(false);
    expect(r!.roomTypes.find((t) => t.type === "Triple")?.available).toBe(true);
    // Doble (USD 160) está completa: el "desde" es el del Triple.
    expect(r!.priceFromUsd).toBe(190);
  });

  it("la comunidad marca el estado del tipo aunque haya camas físicas libres", async () => {
    const summary = await getCommunityVisibility(admin, residenceId, "guest");
    const doble = summary.byRoomType.find((t) => t.roomTypeId === dobleId);
    const triple = summary.byRoomType.find((t) => t.roomTypeId === tripleId);
    expect(doble?.availabilityState).toBe("full");
    expect(doble?.rooms.reduce((sum, room) => sum + room.freeBeds, 0)).toBeGreaterThan(0);
    expect(doble?.availableCount).toBe(0);
    expect(triple?.availabilityState).toBe("available");
  });
});
