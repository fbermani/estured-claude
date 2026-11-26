import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { loadRequestableRoomType } from "@/lib/availability/loadRequestableRoomType";

/**
 * DR69: puerta única de «¿este tipo admite una solicitud nueva?» para la solicitud del estudiante, la propuesta del
 * familiar y su aceptación. Fixture: un tipo sin actualizar todavía visible (días 30 a 45), otro ya oculto (45+) y uno disponible.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("loadRequestableRoomType (integración, DR69)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  const ids: Record<"visible" | "oculto" | "disponible", string> = { visible: "", oculto: "", disponible: "" };

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (DR69 — sin actualizar)",
        slug: `residencia-test-dr69-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "draft",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 3,
        created_by: owner!.id,
      })
      .select("id")
      .single();
    residenceId = residence!.id;

    try {
      const mk = async (name: string, status: string, hidden: string | null) => {
        const { data: rt, error } = await admin
          .from("room_types")
          .insert({ residence_id: residenceId, name, monthly_price_usd: 200, monthly_price_ars: 300000, capacity_per_room: 1, is_active: true })
          .select("id")
          .single();
        if (error || !rt) throw new Error(`room_types: ${error?.message}`);
        const { error: avError } = await admin.from("profile_availability").insert({
          residence_id: residenceId,
          room_type_id: rt.id,
          status,
          available_count: status === "available_to_confirm" ? 1 : 0,
          hidden_from_search_at: hidden,
          last_confirmed_by: owner!.id,
        });
        if (avError) throw new Error(`profile_availability: ${avError.message}`);
        return rt.id as string;
      };
      ids.visible = await mk("Individual", "not_updated", null);
      ids.oculto = await mk("Doble", "not_updated", new Date().toISOString());
      ids.disponible = await mk("Triple", "available_to_confirm", null);
    } catch (error) {
      await deleteResidenceCascade(admin, residenceId);
      throw error;
    }
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await deleteResidenceCascade(admin, residenceId);
  });

  it("entre los días 30 y 45 admite la solicitud y devuelve el tipo", async () => {
    const result = await loadRequestableRoomType(admin, residenceId, ids.visible);
    expect(result).toEqual({ ok: true, roomType: { id: ids.visible, monthlyPriceUsd: 200 } });
  });

  it("un tipo disponible se admite", async () => {
    expect((await loadRequestableRoomType(admin, residenceId, ids.disponible)).ok).toBe(true);
  });

  it("desde el día 45 rechaza con el mensaje aprobado", async () => {
    expect(await loadRequestableRoomType(admin, residenceId, ids.oculto)).toEqual({
      ok: false,
      error: "La residencia no actualizó la disponibilidad de esta habitación. Probá otro tipo.",
    });
  });

  it("rechaza un tipo de otra residencia o inexistente", async () => {
    expect(await loadRequestableRoomType(admin, residenceId, "00000000-0000-0000-0000-000000000000")).toEqual({
      ok: false,
      error: "Ese tipo de habitación ya no está disponible.",
    });
  });
});
