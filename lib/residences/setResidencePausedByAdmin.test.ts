import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setResidencePausedByAdmin } from "@/lib/residences/setResidencePausedByAdmin";

/**
 * Docs/12 §17 Fase 11 ("Admin puede... penalizar o suspender
 * residencias") — Ciclo 34duodecies. `paused_by_admin` ya existía en
 * `residence_status` desde el Ciclo 2-3 pero nada lo alcanzaba nunca.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("setResidencePausedByAdmin (integración)", () => {
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
        name: "Residencia Test Integración (Ciclo 34duodecies — pausar)",
        slug: `residencia-test-pausar-${Date.now()}`,
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

  it("rechaza pausar sin motivo", async () => {
    const result = await setResidencePausedByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      paused: true,
      reason: "hi",
    });
    expect(result.status).toBe("error");
  });

  it("pausa y reactiva una residencia, auditando y notificando al owner en ambos sentidos", async () => {
    const pauseResult = await setResidencePausedByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      paused: true,
      reason: "Denuncia recibida, en revisión con el equipo legal.",
    });
    expect(pauseResult.status).toBe("ok");

    const { data: paused } = await admin.from("residences").select("status").eq("id", residenceId).single();
    expect(paused?.status).toBe("paused_by_admin");

    const { data: pauseNotification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", residenceId)
      .eq("title", "EstuRed pausó tu residencia")
      .maybeSingle();
    expect(pauseNotification?.title).toBe("EstuRed pausó tu residencia");

    // No se puede pausar dos veces (ya no está verified_active).
    const doublePause = await setResidencePausedByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      paused: true,
      reason: "Segundo intento, no debería andar.",
    });
    expect(doublePause.status).toBe("error");

    const reactivateResult = await setResidencePausedByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      paused: false,
      reason: "",
    });
    expect(reactivateResult.status).toBe("ok");

    const { data: reactivated } = await admin.from("residences").select("status").eq("id", residenceId).single();
    expect(reactivated?.status).toBe("verified_active");

    const { data: reactivateNotification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", residenceId)
      .eq("title", "EstuRed reactivó tu residencia")
      .maybeSingle();
    expect(reactivateNotification?.title).toBe("EstuRed reactivó tu residencia");
  });
});
