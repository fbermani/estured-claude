import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setResidenceLocationByAdmin } from "@/lib/residences/setResidenceLocationByAdmin";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";

/**
 * Ciclo 55 (D19): carga de la coordenada por el admin (ubicación pública, se guarda exacta). Necesita la migración 0042 aplicada en
 * la base de desarrollo; si todavía no está, los tests de base se saltean (la validación pura vive en
 * `residenceLocation.test.ts`).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("setResidenceLocationByAdmin (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let adminActorId: string;
  let migrationApplied = false;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = adminUser!.id;

    const { data: residence, error: insertError } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 55 — ubicación)",
        slug: `residencia-test-ubicacion-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: owner!.id,
      })
      .select("id")
      .single();
    if (!residence) throw new Error(`insert residence falló: ${insertError?.message}`);
    residenceId = residence.id;

    const { error } = await admin.from("residences").select("latitude, longitude").eq("id", residenceId).maybeSingle();
    migrationApplied = !error;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin.from("audit_logs").delete().eq("entity_id", residenceId);
    await deleteResidenceCascade(admin, residenceId);
  });

  it("rechaza datos inválidos sin tocar la base", async () => {
    for (const [lat, lng] of [
      ["-34.58", ""],
      ["abc", "-58.4"],
      ["95", "-58.4"],
    ]) {
      const result = await setResidenceLocationByAdmin(admin, {
        residenceId,
        actorUserId: adminActorId,
        actorRole: "admin",
        latitude: lat,
        longitude: lng,
      });
      expect(result.status).toBe("error");
    }
  });

  it("guarda la coordenada exacta (6 decimales), audita y permite quitarla", async (ctx) => {
    if (!migrationApplied) ctx.skip();
    const saved = await setResidenceLocationByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      latitude: "-34,581234",
      longitude: "-58.421567",
    });
    expect(saved).toEqual({ status: "ok", lat: -34.581234, lng: -58.421567 });

    const { data: row } = await admin.from("residences").select("latitude, longitude").eq("id", residenceId).single();
    expect(Number(row!.latitude)).toBe(-34.581234);
    expect(Number(row!.longitude)).toBe(-58.421567);

    const { data: log } = await admin
      .from("audit_logs")
      .select("action, new_value")
      .eq("entity_id", residenceId)
      .eq("action", "residence_location_updated")
      .limit(1)
      .maybeSingle();
    expect(log?.action).toBe("residence_location_updated");

    const removed = await setResidenceLocationByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      latitude: "",
      longitude: "",
    });
    expect(removed).toEqual({ status: "ok", lat: null, lng: null });
    const { data: cleared } = await admin.from("residences").select("latitude, longitude").eq("id", residenceId).single();
    expect(cleared!.latitude).toBeNull();
    expect(cleared!.longitude).toBeNull();
  });

  it("la base rechaza coordenadas a medias o fuera de rango (CHECK)", async (ctx) => {
    if (!migrationApplied) ctx.skip();
    const half = await admin.from("residences").update({ latitude: -34.581, longitude: null }).eq("id", residenceId);
    expect(half.error).not.toBeNull();
    const outOfRange = await admin.from("residences").update({ latitude: 120, longitude: -58.4 }).eq("id", residenceId);
    expect(outOfRange.error).not.toBeNull();
  });
});
