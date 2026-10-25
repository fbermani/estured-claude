import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setOperationalAccessByAdmin } from "@/lib/residences/setOperationalAccessByAdmin";

/**
 * Fase 9bis — mecanismo de acceso freemium a Gestión Operativa
 * (docs/12 §15.3, migración 0030, Ciclo 34unodevicies). Residencia de
 * prueba propia (no una de las 3 demo compartidas) para no interferir
 * con otros tests ni con el dataset de `seed-demo-data.mjs`.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("setOperationalAccessByAdmin (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let ownerId: string;
  let adminActorId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = adminUser!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 34unodevicies-sexies — acceso operativo)",
        slug: `residencia-test-operational-access-${Date.now()}`,
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

    const { error: residenceUsersError } = await admin
      .from("residence_users")
      .insert({ residence_id: residenceId, user_id: ownerId, role: "owner", is_active: true });
    if (residenceUsersError) {
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(`No se pudo dar acceso al owner demo (¿límite de 10 residencias?): ${residenceUsersError.message}`);
    }
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("notifications").delete().eq("related_entity_id", residenceId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("rechaza otorgar/revocar sin motivo", async () => {
    const grant = await setOperationalAccessByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      granted: true,
      reason: "hi",
      expiresAt: null,
    });
    expect(grant.status).toBe("error");
  });

  it("otorga con vigencia, revoca, y audita/notifica en ambos sentidos", async () => {
    const grantResult = await setOperationalAccessByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      granted: true,
      reason: "Residencia pionera, prueba de integración.",
      expiresAt: "2027-12-31",
    });
    expect(grantResult.status).toBe("ok");

    const { data: granted } = await admin
      .from("residences")
      .select("has_operational_management_access, pioneer_free_access_until")
      .eq("id", residenceId)
      .single();
    expect(granted?.has_operational_management_access).toBe(true);
    expect(granted?.pioneer_free_access_until).toBe("2027-12-31");
    // Ciclo 56: el motivo/auditoría interna del acceso es privado (`residence_private_details`).
    const { data: grantedPrivate } = await admin
      .from("residence_private_details")
      .select("operational_access_reason, operational_access_granted_by")
      .eq("residence_id", residenceId)
      .single();
    expect(grantedPrivate?.operational_access_reason).toBe("Residencia pionera, prueba de integración.");
    expect(grantedPrivate?.operational_access_granted_by).toBe(adminActorId);

    const { data: grantLog } = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_type", "residences")
      .eq("entity_id", residenceId)
      .eq("action", "operational_access_granted")
      .maybeSingle();
    expect(grantLog).not.toBeNull();

    const { data: grantNotification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", residenceId)
      .eq("title", "EstuRed activó tu acceso a Gestión Operativa")
      .maybeSingle();
    // DR12/D8: ya no se notifica a la residencia.
    expect(grantNotification).toBeNull();

    const revokeResult = await setOperationalAccessByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      granted: false,
      reason: "Fin de la prueba de integración.",
      expiresAt: null,
    });
    expect(revokeResult.status).toBe("ok");

    const { data: revoked } = await admin
      .from("residences")
      .select("has_operational_management_access, pioneer_free_access_until")
      .eq("id", residenceId)
      .single();
    expect(revoked?.has_operational_management_access).toBe(false);
    expect(revoked?.pioneer_free_access_until).toBeNull();

    const { data: revokeNotification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", residenceId)
      .eq("title", "EstuRed revocó tu acceso a Gestión Operativa")
      .maybeSingle();
    expect(revokeNotification).toBeNull();

    const { data: revokeLog } = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_type", "residences")
      .eq("entity_id", residenceId)
      .eq("action", "operational_access_revoked")
      .maybeSingle();
    expect(revokeLog).not.toBeNull();
  });
});
