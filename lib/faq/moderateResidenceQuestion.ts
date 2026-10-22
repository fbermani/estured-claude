import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { assertResidenceAccess } from "@/lib/residences/access";
import { validateAnswer } from "@/lib/faq/validateFaq";

export type ModerateResult = { ok: true } | { ok: false; error: string };

type QuestionRow = {
  id: string;
  residence_id: string;
  status: "pending" | "answered" | "hidden";
  answer: string | null;
  asked_by_user_id: string | null;
  hidden_by_user_id: string | null;
};

const NOT_FOUND = { ok: false as const, error: "No encontramos esa pregunta. Recargá la página." };
const STALE = { ok: false as const, error: "La pregunta cambió mientras la mirabas. Recargá la página." };

/** Valida acceso a ESTA residencia (docs/11 §7.3) y que la pregunta sea de ella. */
async function loadQuestion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; questionId: string },
): Promise<{ ok: true; row: QuestionRow; actorRole: string } | { ok: false; error: string }> {
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  const [{ data: row, error: rowError }, { data: membership, error: membershipError }] = await Promise.all([
    admin
      .from("residence_faq_questions")
      .select("id, residence_id, status, answer, asked_by_user_id, hidden_by_user_id")
      .eq("id", params.questionId)
      .eq("residence_id", params.residenceId)
      .maybeSingle(),
    admin
      .from("residence_users")
      .select("role")
      .eq("residence_id", params.residenceId)
      .eq("user_id", params.actorUserId)
      .maybeSingle(),
  ]);
  if (rowError || membershipError) {
    console.error("[faq] load failed:", (rowError ?? membershipError)?.code, (rowError ?? membershipError)?.message);
    return { ok: false, error: "No pudimos cargar la pregunta. Intentá de nuevo." };
  }
  if (!row) return NOT_FOUND;
  return {
    ok: true,
    row: row as QuestionRow,
    actorRole: membership?.role === "staff" ? "residence_staff" : "residence_owner",
  };
}

/** Responde (o corrige la respuesta de) una pregunta no oculta. */
export async function answerResidenceQuestion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; questionId: string; answer: unknown },
): Promise<ModerateResult> {
  const checked = validateAnswer(params.answer);
  if (!checked.ok) return checked;

  const loaded = await loadQuestion(admin, params);
  if (!loaded.ok) return loaded;
  const { row, actorRole } = loaded;
  if (row.status === "hidden") {
    return { ok: false, error: "Esa pregunta está oculta. Restaurala si querés responderla." };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("residence_faq_questions")
    .update({ status: "answered", answer: checked.value, answered_by_user_id: params.actorUserId, answered_at: now })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id");
  if (error) {
    console.error("[faq] answer failed:", error.code, error.message);
    return { ok: false, error: "No pudimos guardar la respuesta. Intentá de nuevo." };
  }
  if (!updated?.length) return STALE;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: row.status === "pending" ? "residence_faq_answered" : "residence_faq_answer_edited",
    entityType: "residence_faq_questions",
    entityId: row.id,
    oldValue: { status: row.status, answer: row.answer },
    newValue: { status: "answered", answer: checked.value },
  });

  // Aviso al visitante solo la primera vez y solo si tenía sesión.
  if (row.status === "pending" && row.asked_by_user_id) {
    await createNotification(admin, {
      userId: row.asked_by_user_id,
      title: "Una residencia respondió tu pregunta",
      body: "La residencia respondió la pregunta que hiciste en su ficha. Ya la podés leer ahí.",
      relatedEntityType: "residence_faq_questions",
      relatedEntityId: row.id,
    });
  }
  return { ok: true };
}

/** Oculta una pregunta (moderación). Deja de verse en la ficha; se puede restaurar. */
export async function hideResidenceQuestion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; questionId: string },
): Promise<ModerateResult> {
  const loaded = await loadQuestion(admin, params);
  if (!loaded.ok) return loaded;
  const { row, actorRole } = loaded;
  if (row.status === "hidden") return { ok: true };

  const { data: updated, error } = await admin
    .from("residence_faq_questions")
    .update({ status: "hidden", hidden_by_user_id: params.actorUserId, hidden_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id");
  if (error) {
    console.error("[faq] hide failed:", error.code, error.message);
    return { ok: false, error: "No pudimos ocultar la pregunta. Intentá de nuevo." };
  }
  if (!updated?.length) return STALE;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "residence_faq_hidden",
    entityType: "residence_faq_questions",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { status: "hidden" },
  });
  return { ok: true };
}

/** Restaura una pregunta oculta: vuelve a `answered` si tiene respuesta, si no a `pending`. */
export async function restoreResidenceQuestion(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string; questionId: string },
): Promise<ModerateResult> {
  const loaded = await loadQuestion(admin, params);
  if (!loaded.ok) return loaded;
  const { row, actorRole } = loaded;
  if (row.status !== "hidden") return { ok: true };

  // Si la ocultó el equipo de EstuRed (no alguien de esta residencia), la residencia no puede revertirlo.
  if (row.hidden_by_user_id && row.hidden_by_user_id !== params.actorUserId) {
    const { data: hiddenByMember, error: memberError } = await admin
      .from("residence_users")
      .select("id")
      .eq("residence_id", params.residenceId)
      .eq("user_id", row.hidden_by_user_id)
      .maybeSingle();
    if (memberError) {
      console.error("[faq] restore member lookup failed:", memberError.code, memberError.message);
      return { ok: false, error: "No pudimos restaurar la pregunta. Intentá de nuevo." };
    }
    if (!hiddenByMember) {
      return {
        ok: false,
        error: "Esta pregunta la ocultó el equipo de EstuRed. Si creés que es un error, escribile a Soporte.",
      };
    }
  }

  const target = row.answer ? "answered" : "pending";
  const { data: updated, error } = await admin
    .from("residence_faq_questions")
    .update({ status: target, hidden_by_user_id: null, hidden_at: null })
    .eq("id", row.id)
    .eq("status", "hidden")
    .select("id");
  if (error) {
    console.error("[faq] restore failed:", error.code, error.message);
    return { ok: false, error: "No pudimos restaurar la pregunta. Intentá de nuevo." };
  }
  if (!updated?.length) return STALE;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole,
    action: "residence_faq_restored",
    entityType: "residence_faq_questions",
    entityId: row.id,
    oldValue: { status: "hidden" },
    newValue: { status: target },
  });
  return { ok: true };
}

/**
 * Moderación por el equipo de EstuRed (admin/superadmin): oculta una pregunta
 * de cualquier residencia. El rol se valida en el server action; acá queda
 * auditado con el motivo. La residencia no puede restaurarla (ver
 * `restoreResidenceQuestion`).
 */
export async function hideResidenceQuestionByAdmin(
  admin: SupabaseClient,
  params: { actorUserId: string; actorRole: string; questionId: string; reason?: string },
): Promise<ModerateResult> {
  const { data: row, error: loadError } = await admin
    .from("residence_faq_questions")
    .select("id, status")
    .eq("id", params.questionId)
    .maybeSingle();
  if (loadError) {
    console.error("[faq] admin load failed:", loadError.code, loadError.message);
    return { ok: false, error: "No pudimos cargar la pregunta. Intentá de nuevo." };
  }
  if (!row) return NOT_FOUND;
  if (row.status === "hidden") return { ok: true };

  const { data: updated, error } = await admin
    .from("residence_faq_questions")
    .update({ status: "hidden", hidden_by_user_id: params.actorUserId, hidden_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id");
  if (error) {
    console.error("[faq] admin hide failed:", error.code, error.message);
    return { ok: false, error: "No pudimos ocultar la pregunta. Intentá de nuevo." };
  }
  if (!updated?.length) return STALE;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_faq_hidden_by_admin",
    entityType: "residence_faq_questions",
    entityId: row.id,
    oldValue: { status: row.status },
    newValue: { status: "hidden" },
    reasonText: params.reason?.trim() || undefined,
    source: "admin",
  });
  return { ok: true };
}

/**
 * Restaura una pregunta oculta (admin/superadmin). A diferencia de
 * `restoreResidenceQuestion`, no depende de quién la ocultó: el equipo de
 * EstuRed puede revertir tanto lo que ocultó él como lo que ocultó una
 * residencia. El rol se valida en el server action; queda auditado.
 */
export async function restoreResidenceQuestionByAdmin(
  admin: SupabaseClient,
  params: { actorUserId: string; actorRole: string; questionId: string },
): Promise<ModerateResult> {
  const { data: row, error: loadError } = await admin
    .from("residence_faq_questions")
    .select("id, status, answer")
    .eq("id", params.questionId)
    .maybeSingle();
  if (loadError) {
    console.error("[faq] admin load failed:", loadError.code, loadError.message);
    return { ok: false, error: "No pudimos cargar la pregunta. Intentá de nuevo." };
  }
  if (!row) return NOT_FOUND;
  if (row.status !== "hidden") return { ok: true };

  const target = row.answer ? "answered" : "pending";
  const { data: updated, error } = await admin
    .from("residence_faq_questions")
    .update({ status: target, hidden_by_user_id: null, hidden_at: null })
    .eq("id", row.id)
    .eq("status", "hidden")
    .select("id");
  if (error) {
    console.error("[faq] admin restore failed:", error.code, error.message);
    return { ok: false, error: "No pudimos restaurar la pregunta. Intentá de nuevo." };
  }
  if (!updated?.length) return STALE;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "residence_faq_restored_by_admin",
    entityType: "residence_faq_questions",
    entityId: row.id,
    oldValue: { status: "hidden" },
    newValue: { status: target },
    source: "admin",
  });
  return { ok: true };
}
