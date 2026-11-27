import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";
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
  // Estudiante descartable: arranca sin casos ni cupo usado (0083) y no toca avisos del seed.
  let student: TestStudent;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    adminActorId = adminUser!.id;
    student = await createTestStudent(admin, "soporte");

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 34quindecies — soporte)",
        slug: `residencia-test-soporte-${Date.now()}`,
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
    if (residenceId) {
      // Solo lo de los casos de esta residencia: los avisos y casos del seed quedan como están.
      const { data: cases, error } = await admin.from("support_cases").select("id").eq("residence_id", residenceId);
      if (error) throw new Error(`limpieza casos: ${error.message}`);
      const caseIds = (cases ?? []).map((row) => row.id as string);
      for (const caseId of caseIds) {
        const bucket = admin.storage.from("support-evidence");
        const { data: objects } = await bucket.list(caseId);
        if (objects?.length) await bucket.remove(objects.map((object) => `${caseId}/${object.name}`));
      }
      if (caseIds.length > 0) {
        const { error: filesError } = await admin
          .from("files")
          .delete()
          .eq("related_entity_type", "support_cases")
          .in("related_entity_id", caseIds);
        if (filesError) throw new Error(`limpieza archivos: ${filesError.message}`);
      }
      await admin.from("residence_users").delete().eq("residence_id", residenceId);
      // La cascada borra los casos y sus avisos (los busca por id de caso, así que va con los casos todavía vivos).
      await deleteResidenceCascade(admin, residenceId);
    }
    await deleteTestStudent(admin, student);
  });

  it("rechaza abrir sin aceptar términos", async () => {
    const result = await openSupportCase(admin, {
      actorUserId: student.userId,
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
      actorUserId: student.userId,
      actorRole: "student",
      residenceId,
      description: "corto",
      termsReminderAccepted: true,
      evidenceFiles: [],
    });
    expect(result.ok).toBe(false);
  });

  it("sube evidencia real al bucket support-evidence y crea la fila en files", async () => {
    const evidenceFile = new File([new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: "image/png" })], "captura.png", {
      type: "image/png",
    });
    const opened = await openSupportCase(admin, {
      actorUserId: student.userId,
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
      actorUserId: student.userId,
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
      // Abrir el caso también avisa a cada admin con el mismo id: acá interesa el aviso de quien lo abrió.
      .eq("user_id", student.userId)
      .maybeSingle();
    expect(notification?.title).toBe("Tu caso de soporte se resolvió");
  });
});
