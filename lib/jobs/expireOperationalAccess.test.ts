import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expireOperationalAccess } from "@/lib/jobs/expireOperationalAccess";

/**
 * Fase 9bis (migración 0030, Ciclo 34unodevicies). El job corre sobre
 * TODAS las residencias con `pioneer_free_access_until` vencido, no solo
 * la de este fixture — `expiredCount` se chequea con
 * `toBeGreaterThanOrEqual`, mismo criterio que `expireApplicationRequests.test.ts`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("expireOperationalAccess (integración)", () => {
  let admin: SupabaseClient;
  let staleResidenceId: string;
  let noDeadlineResidenceId: string;
  let ownerId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;

    async function createResidence(nameSuffix: string, pioneerUntil: string | null) {
      const { data: residence, error } = await admin
        .from("residences")
        .insert({
          name: `Residencia Test Integración (Ciclo 34unodevicies-sexies — ${nameSuffix})`,
          slug: `residencia-test-expire-op-access-${nameSuffix}-${Date.now()}`,
          property_type: "residencia_estudiantil",
          status: "verified_active",
          operating_mode: "verified_profile",
          public_area: "Palermo",
          responsible_name: "Test",
          responsible_contact: "+54 9 11 0000-0000",
          total_capacity: 5,
          created_by: ownerId,
          has_operational_management_access: true,
          pioneer_free_access_until: pioneerUntil,
        })
        .select("id")
        .single();
      if (error) throw error;
      await admin.from("residence_users").insert({ residence_id: residence!.id, user_id: ownerId, role: "owner", is_active: true });
      return residence!.id;
    }

    staleResidenceId = await createResidence("vencida", "2020-01-01");
    noDeadlineResidenceId = await createResidence("sin-limite", null);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [staleResidenceId, noDeadlineResidenceId]) {
      await admin.from("notifications").delete().eq("related_entity_id", id);
      await admin.from("residence_users").delete().eq("residence_id", id);
      const { error } = await admin.from("residences").delete().eq("id", id);
      if (error) console.error("[test cleanup] delete residence failed:", error);
    }
  });

  it("revoca acceso vencido, deja intacto el acceso sin fecha límite, audita y notifica", async () => {
    const result = await expireOperationalAccess(admin);
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const { data: stale } = await admin
      .from("residences")
      .select("has_operational_management_access")
      .eq("id", staleResidenceId)
      .single();
    expect(stale?.has_operational_management_access).toBe(false);

    const { data: noDeadline } = await admin
      .from("residences")
      .select("has_operational_management_access")
      .eq("id", noDeadlineResidenceId)
      .single();
    expect(noDeadline?.has_operational_management_access).toBe(true);

    const { data: log } = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_type", "residences")
      .eq("entity_id", staleResidenceId)
      .eq("action", "operational_access_expired")
      .maybeSingle();
    expect(log).not.toBeNull();

    const { data: notification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", staleResidenceId)
      .eq("title", "Tu acceso a Gestión Operativa venció")
      .maybeSingle();
    expect(notification).not.toBeNull();
  });
});
