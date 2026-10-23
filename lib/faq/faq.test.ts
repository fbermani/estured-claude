import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { submitResidenceQuestion } from "@/lib/faq/submitResidenceQuestion";
import {
  answerResidenceQuestion,
  hideResidenceQuestion,
  hideResidenceQuestionByAdmin,
  restoreResidenceQuestionByAdmin,
  restoreResidenceQuestion,
} from "@/lib/faq/moderateResidenceQuestion";
import { getPublicAnsweredQuestions } from "@/lib/faq/getPublicAnsweredQuestions";
import { QUESTIONS_PER_HOUR } from "@/lib/faq/validateFaq";

/** FAQ simple (D9 / H12). Requiere la migración 0039; sin credenciales se saltea. */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("residence_faq_questions (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let ownerId: string;
  let strangerId: string;
  let studentId: string;
  const ipHash = `test-ip-${Date.now()}`;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const idOf = async (email: string) => (await admin.from("users").select("id").eq("email", email).single()).data!.id as string;
    ownerId = await idOf("owner.residencia.norte@example.com");
    strangerId = await idOf("admin.operaciones@estured.test");
    studentId = await idOf("lucia.fernandez@example.com");

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (FAQ)",
        slug: `residencia-test-faq-${Date.now()}`,
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
    const { error } = await admin
      .from("residence_users")
      .insert({ residence_id: residenceId, user_id: ownerId, role: "owner", is_active: true });
    if (error) {
      await admin.from("residences").delete().eq("id", residenceId);
      throw new Error(`No se pudo dar acceso al owner demo (¿límite de 10 residencias?): ${error.message}`);
    }
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await admin.from("notifications").delete().eq("related_entity_type", "residence_faq_questions").eq("user_id", ownerId).like("body", "%FAQTEST%");
    await admin.from("notifications").delete().eq("related_entity_type", "residence_faq_questions").eq("user_id", studentId).eq("title", "Una residencia respondió tu pregunta");
    await admin.from("residence_users").delete().eq("residence_id", residenceId);
    await deleteResidenceCascade(admin, residenceId);
  });

  it("rechaza preguntas inválidas sin tocar la base", async () => {
    const r = await submitResidenceQuestion(admin, { residenceId, question: "corta", userId: null, ipHash });
    expect(r.ok).toBe(false);
  });

  it("rechaza una residencia inexistente", async () => {
    const r = await submitResidenceQuestion(admin, {
      residenceId: "00000000-0000-4000-8000-000000000000",
      question: "¿Cuál es el horario de la recepción? FAQTEST",
      userId: null,
      ipHash,
    });
    expect(r.ok).toBe(false);
  });

  it("flujo completo: pregunta anónima -> notifica -> responde -> es pública -> oculta -> restaura", async () => {
    const sent = await submitResidenceQuestion(admin, {
      residenceId,
      question: "¿Cuál es el horario de la recepción? FAQTEST",
      userId: studentId,
      ipHash: null,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    const questionId = sent.questionId;

    // Notificó al owner con la entidad correcta.
    const { data: notes } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", ownerId)
      .eq("related_entity_id", questionId);
    expect(notes?.length).toBe(1);

    // Pendiente: todavía no es pública.
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toEqual([]);

    // Un usuario sin acceso a la residencia no puede responder.
    const denied = await answerResidenceQuestion(admin, { actorUserId: strangerId, residenceId, questionId, answer: "Hola" });
    expect(denied.ok).toBe(false);

    // Respuesta vacía rechazada.
    expect((await answerResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId, answer: "  " })).ok).toBe(false);

    const answered = await answerResidenceQuestion(admin, {
      actorUserId: ownerId,
      residenceId,
      questionId,
      answer: "La recepción atiende de 8 a 22 h.",
    });
    expect(answered.ok).toBe(true);
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toEqual([
      { question: "¿Cuál es el horario de la recepción? FAQTEST", answer: "La recepción atiende de 8 a 22 h." },
    ]);

    // Avisó a quien preguntó (tenía sesión).
    const { data: studentNotes } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", studentId)
      .eq("related_entity_id", questionId);
    expect(studentNotes?.length).toBe(1);

    // Queda auditado.
    const { data: audit } = await admin
      .from("audit_logs")
      .select("action")
      .eq("entity_type", "residence_faq_questions")
      .eq("entity_id", questionId);
    expect(audit?.map((a) => a.action)).toContain("residence_faq_answered");

    // Ocultar la saca de la ficha; restaurar la devuelve (tiene respuesta).
    expect((await hideResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId })).ok).toBe(true);
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toEqual([]);
    expect((await answerResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId, answer: "x" })).ok).toBe(false);
    expect((await restoreResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId })).ok).toBe(true);
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toHaveLength(1);

    // Moderación de EstuRed: la oculta un admin y la residencia no puede revertirlo.
    expect(
      (await hideResidenceQuestionByAdmin(admin, { actorUserId: strangerId, actorRole: "admin", questionId, reason: "test" })).ok,
    ).toBe(true);
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toEqual([]);
    expect((await restoreResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId })).ok).toBe(false);

    // EstuRed sí puede restaurarla, y queda auditado.
    expect(
      (await restoreResidenceQuestionByAdmin(admin, { actorUserId: strangerId, actorRole: "admin", questionId })).ok,
    ).toBe(true);
    expect(await getPublicAnsweredQuestions(admin, residenceId)).toHaveLength(1);
    const { data: auditAfter } = await admin
      .from("audit_logs")
      .select("action")
      .eq("entity_type", "residence_faq_questions")
      .eq("entity_id", questionId);
    expect(auditAfter?.map((a) => a.action)).toContain("residence_faq_restored_by_admin");

    await admin.from("audit_logs").delete().eq("entity_type", "residence_faq_questions").eq("entity_id", questionId);
  });

  it("no deja operar sobre una pregunta de otra residencia", async () => {
    const { data: other } = await admin.from("residence_faq_questions").select("id").neq("residence_id", residenceId).limit(1);
    if (!other?.length) return; // sin datos de otras residencias no hay nada que probar
    const r = await hideResidenceQuestion(admin, { actorUserId: ownerId, residenceId, questionId: other[0].id });
    expect(r.ok).toBe(false);
  });

  it("limita las preguntas por hora por IP", async () => {
    for (let i = 0; i < QUESTIONS_PER_HOUR; i++) {
      const r = await submitResidenceQuestion(admin, {
        residenceId,
        question: `Pregunta de prueba número ${i} para el límite FAQTEST`,
        userId: null,
        ipHash,
      });
      expect(r.ok).toBe(true);
    }
    const blocked = await submitResidenceQuestion(admin, {
      residenceId,
      question: "Una pregunta más que ya no debería pasar FAQTEST",
      userId: null,
      ipHash,
    });
    expect(blocked.ok).toBe(false);
  });
});
