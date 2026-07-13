import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { openSupportCase } from "@/lib/support/openSupportCase";
import { updateSupportCaseStatus } from "@/lib/support/updateSupportCaseStatus";

/**
 * Docs/12 Fase 14 (soporte y resolución de conflictos) — Ciclo
 * 34quindecies. Fixture liviano: no hace falta una reserva completa,
 * un caso de soporte solo depende de residencia + quien lo abre.
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("support_cases (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let ownerId: string;
  let adminActorId: string;
  let studentUserId: string;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = adminUser!.id;
    const { data: studentUser } = await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single();
    studentUserId = studentUser!.id;

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 34quindecies — soporte)",
        slug: `residencia-test-soporte-${Date.now()}`,
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
    await admin.from("notifications").delete().eq("related_entity_type", "support_cases");
    await admin.from("files").delete().eq("related_entity_type", "support_cases");
    await admin.from("support_cases").delete().eq("residence_id", residenceId);
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    const { error } = await admin.from("residences").delete().eq("id", residenceId);
    if (error) console.error("[test cleanup] delete residence failed:", error);
  });

  it("rechaza abrir sin aceptar términos", async () => {
    const result = await openSupportCase(admin, {
      actorUserId: studentUserId,
      actorRole: "student",
      residenceId,
      description: "La residencia canceló mi reserva sin avisar con anticipación.",
      termsReminderAccepted: false,
      evidenceFiles: [],
    });
    expect(result.ok).toBe(false);
  });

  it("rechaza descripción corta", async () => {
    const result = await openSupportCase(admin, {
      actorUserId: studentUserId,
      actorRole: "student",
      residenceId,
      description: "corto",
      termsReminderAccepted: true,
      evidenceFiles: [],
    });
    expect(result.ok).toBe(false);
  });

  it("sube evidencia real al bucket support-evidence y crea la fila en files", async () => {
    const evidenceFile = new File([new Blob(["captura de prueba"], { type: "image/png" })], "captura.png", {
      type: "image/png",
    });
    const opened = await openSupportCase(admin, {
      actorUserId: studentUserId,
      actorRole: "student",
      residenceId,
      description: "Adjunto captura de la conversación con la residencia como evidencia.",
      termsReminderAccepted: true,
      evidenceFiles: [evidenceFile],
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const { data: files } = await admin
      .from("files")
      .select("filename, bucket, document_type, mime_type")
      .eq("related_entity_type", "support_cases")
      .eq("related_entity_id", opened.supportCaseId);
    expect(files?.length).toBe(1);
    expect(files?.[0].filename).toBe("captura.png");
    expect(files?.[0].bucket).toBe("support-evidence");
    expect(files?.[0].document_type).toBe("support_case_evidence");

    const { data: storageList } = await admin.storage.from("support-evidence").list(opened.supportCaseId);
    expect(storageList?.length).toBe(1);
  });

  it("abre un caso, lo lleva a revisión, y lo cierra con resultado y notificación", async () => {
    const opened = await openSupportCase(admin, {
      actorUserId: studentUserId,
      actorRole: "student",
      residenceId,
      description: "La residencia canceló mi reserva sin avisar con anticipación.",
      termsReminderAccepted: true,
      evidenceFiles: [],
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const { data: created } = await admin
      .from("support_cases")
      .select("status, terms_reminder_accepted_at")
      .eq("id", opened.supportCaseId)
      .single();
    expect(created?.status).toBe("opened");
    expect(created?.terms_reminder_accepted_at).not.toBeNull();

    const badClose = await updateSupportCaseStatus(admin, {
      supportCaseId: opened.supportCaseId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "closed_no_action",
      outcome: null,
      notes: "",
    });
    expect(badClose.status).toBe("error");

    const toReview = await updateSupportCaseStatus(admin, {
      supportCaseId: opened.supportCaseId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "under_review",
      outcome: null,
      notes: "Revisando con la residencia.",
    });
    expect(toReview.status).toBe("ok");

    const closed = await updateSupportCaseStatus(admin, {
      supportCaseId: opened.supportCaseId,
      actorUserId: adminActorId,
      actorRole: "admin",
      newStatus: "resolved_by_agreement",
      outcome: "agreement_between_parties",
      notes: "La residencia ofreció una disculpa y reprogramó el ingreso.",
    });
    expect(closed.status).toBe("ok");

    const { data: final } = await admin
      .from("support_cases")
      .select("status, resolution_outcome, resolution_notes, assigned_admin_user_id")
      .eq("id", opened.supportCaseId)
      .single();
    expect(final?.status).toBe("resolved_by_agreement");
    expect(final?.resolution_outcome).toBe("agreement_between_parties");
    expect(final?.assigned_admin_user_id).toBe(adminActorId);

    const { data: notification } = await admin
      .from("notifications")
      .select("title")
      .eq("related_entity_id", opened.supportCaseId)
      .maybeSingle();
    expect(notification?.title).toBe("Tu caso de soporte se resolvió");
  });
});
