import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setUserBlockedStatus } from "@/lib/users/setUserBlockedStatus";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("setUserBlockedStatus (integración)", () => {
  let admin: SupabaseClient;
  let adminActorId: string;
  let targetUserId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: actor } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = actor!.id;

    const { data: target } = await admin.from("users").select("id").eq("email", "valentina.sosa@example.com").single();
    targetUserId = target!.id;
  });

  afterAll(async () => {
    // Deja a Valentina (usuario demo real) siempre desbloqueada, pase lo que pase en el test.
    await admin.from("users").update({ is_blocked: false, blocked_reason: null }).eq("id", targetUserId);
  });

  it("rechaza bloquear la propia cuenta", async () => {
    const result = await setUserBlockedStatus(admin, {
      actorUserId: adminActorId,
      actorRoles: ["admin"],
      targetUserId: adminActorId,
      blocked: true,
      reason: "motivo de prueba",
    });
    expect(result.status).toBe("error");
  });

  it("un admin no puede bloquear a un superadmin (DR9)", async () => {
    const { data: sup } = await admin.from("user_roles").select("user_id").eq("role", "superadmin").limit(1).maybeSingle();
    if (!sup) return; // el entorno no tiene superadmin: nada que probar
    const result = await setUserBlockedStatus(admin, {
      actorUserId: adminActorId,
      actorRoles: ["admin"],
      targetUserId: sup.user_id,
      blocked: true,
      reason: "motivo de prueba",
    });
    expect(result.status).toBe("error");
    const { data: after } = await admin.from("users").select("is_blocked").eq("id", sup.user_id).single();
    expect(after?.is_blocked).toBe(false);
  });

  it("rechaza bloquear sin motivo", async () => {
    const result = await setUserBlockedStatus(admin, {
      actorUserId: adminActorId,
      actorRoles: ["admin"],
      targetUserId,
      blocked: true,
      reason: "hi",
    });
    expect(result.status).toBe("error");
  });

  it("bloquea y luego desbloquea un usuario, auditando ambos pasos", async () => {
    const blockResult = await setUserBlockedStatus(admin, {
      actorUserId: adminActorId,
      actorRoles: ["admin"],
      targetUserId,
      blocked: true,
      reason: "Prueba de integración — bloqueo temporal.",
    });
    expect(blockResult.status).toBe("ok");

    const { data: blocked } = await admin.from("users").select("is_blocked, blocked_reason").eq("id", targetUserId).single();
    expect(blocked?.is_blocked).toBe(true);
    expect(blocked?.blocked_reason).toContain("Prueba de integración");

    const unblockResult = await setUserBlockedStatus(admin, {
      actorUserId: adminActorId,
      actorRoles: ["admin"],
      targetUserId,
      blocked: false,
      reason: "",
    });
    expect(unblockResult.status).toBe("ok");

    const { data: unblocked } = await admin.from("users").select("is_blocked, blocked_reason").eq("id", targetUserId).single();
    expect(unblocked?.is_blocked).toBe(false);
    expect(unblocked?.blocked_reason).toBeNull();

    const { data: logs } = await admin
      .from("audit_logs")
      .select("action")
      .eq("entity_id", targetUserId)
      .in("action", ["user_blocked", "user_unblocked"])
      .order("created_at", { ascending: false })
      .limit(2);
    expect(logs?.map((l) => l.action)).toEqual(["user_unblocked", "user_blocked"]);
  });
});
