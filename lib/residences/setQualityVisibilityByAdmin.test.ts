import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setQualityVisibilityByAdmin, addResidenceInternalNote } from "@/lib/residences/setQualityVisibilityByAdmin";

/**
 * Visibilidad y penalizaciones de calidad (docs/09 §23, migración 0031,
 * Ciclo 34unodevicies-bis). Residencia de prueba propia.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("setQualityVisibilityByAdmin / addResidenceInternalNote (integración)", () => {
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
        name: "Residencia Test Integración (Ciclo 34unodevicies-sexies — visibilidad)",
        slug: `residencia-test-quality-visibility-${Date.now()}`,
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

  it("rechaza un cambio de estado sin motivo", async () => {
    const result = await setQualityVisibilityByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "warning",
      reason: "hi",
    });
    expect(result.status).toBe("error");
  });

  it("recorre advertencia → reducida → normal, auditando y notificando en cada paso", async () => {
    const warning = await setQualityVisibilityByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "warning",
      reason: "Tasa de respuesta baja detectada.",
    });
    expect(warning.status).toBe("ok");

    const { data: afterWarning } = await admin.from("residences").select("quality_visibility_status").eq("id", residenceId).single();
    expect(afterWarning?.quality_visibility_status).toBe("warning");

    const { data: warningLog } = await admin
      .from("audit_logs")
      .select("id")
      .eq("entity_type", "residences")
      .eq("entity_id", residenceId)
      .eq("action", "residence_visibility_warning_issued")
      .maybeSingle();
    expect(warningLog).not.toBeNull();

    const reduced = await setQualityVisibilityByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "reduced_visibility",
      reason: "Sin mejora tras la advertencia.",
    });
    expect(reduced.status).toBe("ok");

    const { data: afterReduced } = await admin.from("residences").select("quality_visibility_status").eq("id", residenceId).single();
    expect(afterReduced?.quality_visibility_status).toBe("reduced_visibility");

    const restored = await setQualityVisibilityByAdmin(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "normal_visibility",
      reason: "La residencia mejoró su tasa de respuesta.",
    });
    expect(restored.status).toBe("ok");

    const { data: afterRestored } = await admin.from("residences").select("quality_visibility_status").eq("id", residenceId).single();
    expect(afterRestored?.quality_visibility_status).toBe("normal_visibility");

    const { data: restoreNotification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", residenceId)
      .eq("title", "EstuRed restauró la visibilidad normal de tu residencia")
      .maybeSingle();
    expect(restoreNotification).not.toBeNull();
  });

  it("agrega una nota interna sin cambiar el estado ni notificar al dueño", async () => {
    const { data: statusBefore } = await admin.from("residences").select("quality_visibility_status").eq("id", residenceId).single();

    const note = await addResidenceInternalNote(admin, {
      residenceId,
      actorUserId: adminActorId,
      actorRole: "admin",
      note: "Seguimiento interno de prueba de integración.",
    });
    expect(note.status).toBe("ok");

    const { data: statusAfter } = await admin.from("residences").select("quality_visibility_status").eq("id", residenceId).single();
    expect(statusAfter?.quality_visibility_status).toBe(statusBefore?.quality_visibility_status);

    const { data: noteLog } = await admin
      .from("audit_logs")
      .select("reason_text")
      .eq("entity_type", "residences")
      .eq("entity_id", residenceId)
      .eq("action", "residence_internal_note_added")
      .maybeSingle();
    expect(noteLog?.reason_text).toBe("Seguimiento interno de prueba de integración.");

    const { count: notificationCount } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("related_entity_id", residenceId)
      .ilike("title", "%nota%");
    expect(notificationCount ?? 0).toBe(0);
  });
});
