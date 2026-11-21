import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { resolvePaymentActor } from "@/lib/applications/studentPaymentAccess";
import { isPaymentClosedForStudent, isPaymentIssueOpen, validateIssueReason } from "@/lib/applications/paymentReportView";
import { discardStoredProof, storeStudentPaymentProof, validateOptionalProof, type ValidatedProof } from "@/lib/applications/studentPaymentProof";
import { notifyPaymentCounterpart, notifyResidencePaymentTeam } from "@/lib/applications/paymentReportNotices";

/**
 * El estudiante (o el familiar pagador de un menor) avisa el pago de la reserva a la residencia (DR63 (e) y (l); docs/07 §16.4 y §16.9).
 * Capa de negocio con `(admin, params)`, sin `next/headers`: la usan las server actions de `app/students/applications/[id]/payment/`.
 *
 * Reglas comunes:
 *  - El actor sale de la BASE (`resolvePaymentActor`): estudiante de la solicitud, o familiar pagador de un menor. Todo lo demás recibe
 *    «No encontramos esa solicitud» (no se filtra si existe).
 *  - Solo con `application_requests.status = residence_payment_pending` y `collection_mode = enabled_methods`. NO cambia la máquina de
 *    estados de la solicitud: sigue en `residence_payment_pending` hasta que la residencia confirma (docs/04 §5.8).
 *  - El cambio se reclama con un update condicional; los efectos (aviso, auditoría) salen SOLO si el reclamo devolvió la fila: un segundo
 *    toque no hace nada (idempotente).
 *  - Cada evento nuevo limpia las tres marcas del job (`residence_reminder_sent_at`, `student_reminder_sent_at`, `admin_alert_sent_at`)
 *    para no suprimir los avisos del segundo evento (docs/07 §16.8).
 *  - Ni la auditoría ni los avisos llevan datos de cobro, montos ni el texto libre del motivo.
 */

export type ReportPaymentResult = { ok: true; alreadyReported: boolean } | { ok: false; error: string };

const NOT_FOUND = "No encontramos esa solicitud.";
const READ_FAILED = "No pudimos verificar tu pago. Intentá de nuevo en unos minutos.";
const SAVE_FAILED = "No pudimos guardar el aviso. Intentá de nuevo en unos minutos.";
const NOT_PENDING = "Esta solicitud ya no está esperando tu pago a la residencia.";
const NOT_ENABLED_METHODS = "El pago de esta solicitud lo coordina la residencia por WhatsApp. No hace falta que avises nada acá.";

const CLEAR_MARKS = { residence_reminder_sent_at: null, student_reminder_sent_at: null, admin_alert_sent_at: null } as const;

type PaymentRow = {
  id: string;
  status: string;
  student_reported_paid_at: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
};

async function loadActiveContext(admin: SupabaseClient, userId: string, applicationId: string) {
  const actor = await resolvePaymentActor(admin, userId, applicationId);
  if (!actor.ok) return { ok: false as const, error: actor.reason === "read_failed" ? READ_FAILED : NOT_FOUND };
  const { application } = actor;
  if (application.status !== "residence_payment_pending") return { ok: false as const, error: NOT_PENDING };
  if (application.collection_mode !== "enabled_methods") return { ok: false as const, error: NOT_ENABLED_METHODS };

  const { data, error } = await admin
    .from("external_residence_payments")
    .select("id, status, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (error) {
    console.error("[payment-report] payment read failed:", error.code, error.message);
    return { ok: false as const, error: READ_FAILED };
  }
  if (!data) return { ok: false as const, error: "No encontramos el registro de pago de esta solicitud." };
  return { ok: true as const, actor, payment: data as PaymentRow };
}

/** «Ya pagué»: marca `student_reported_paid`, frena el vencimiento (por la fecha) y avisa a la residencia. Comprobante opcional. */
export async function reportResidencePaymentPaidCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; proofInput?: FormDataEntryValue | null },
): Promise<ReportPaymentResult> {
  const ctx = await loadActiveContext(admin, params.actorUserId, params.applicationId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { actor, payment } = ctx;

  if (payment.status === "student_reported_paid") return { ok: true, alreadyReported: true };
  if (isPaymentClosedForStudent(payment.status)) return { ok: false, error: "Este pago ya no admite cambios. Si necesitás ayuda, escribile a Soporte." };
  if (isPaymentIssueOpen(payment)) {
    return { ok: false, error: "Ya avisaste que no pudiste pagar. Esperá a que la residencia te responda." };
  }

  // Todo se valida ANTES de escribir.
  const checked = await validateOptionalProof(params.proofInput ?? null);
  if (!checked.ok) return { ok: false, error: checked.error };
  const proof: ValidatedProof | null = checked.proof;
  const stored = proof ? await storeStudentPaymentProof(admin, { applicationId: params.applicationId, ownerUserId: params.actorUserId, proof }) : null;
  if (proof && !stored) return { ok: false, error: "No pudimos subir el comprobante. Intentá de nuevo o avisá el pago sin comprobante." };

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("external_residence_payments")
    .update({
      status: "student_reported_paid",
      student_reported_paid_at: now,
      ...CLEAR_MARKS,
      ...(stored ? { student_proof_file_id: stored.fileId } : {}),
    })
    .eq("id", payment.id)
    .in("status", ["pending", "student_reference_uploaded"])
    .select("id");
  if (claimError || !claimed || claimed.length === 0) {
    if (stored) await discardStoredProof(admin, stored);
    if (claimError) {
      console.error("[payment-report] claim failed:", claimError.code, claimError.message);
      return { ok: false, error: SAVE_FAILED };
    }
    // Alguien lo reclamó antes (doble toque simultáneo): se vuelve a leer para devolver el resultado correcto.
    const { data: again } = await admin.from("external_residence_payments").select("status").eq("id", payment.id).maybeSingle();
    if (again?.status === "student_reported_paid") return { ok: true, alreadyReported: true };
    return { ok: false, error: "Este pago ya no admite cambios. Actualizá la página." };
  }

  // Carrera con el job de vencimiento: si la solicitud venció entre la lectura y este update, se deshace el aviso.
  const { data: still } = await admin.from("application_requests").select("status").eq("id", params.applicationId).maybeSingle();
  if (still && still.status !== "residence_payment_pending") {
    await admin
      .from("external_residence_payments")
      .update({ status: payment.status, student_reported_paid_at: null })
      .eq("id", payment.id)
      .eq("status", "student_reported_paid");
    if (stored) await discardStoredProof(admin, stored);
    return { ok: false, error: NOT_PENDING };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: actor.role === "student" ? "student" : "family_member",
    action: "residence_payment_reported_paid",
    entityType: "application_requests",
    entityId: params.applicationId,
    newValue: { payment_status: "student_reported_paid", with_proof: Boolean(stored), reported_by: actor.role },
    source: "user",
  });
  await notifyResidencePaymentTeam(admin, {
    applicationId: params.applicationId,
    residenceId: actor.application.residence_id,
    kind: "student_reported_paid",
    isMinor: actor.isMinor,
  });
  if (actor.isMinor) {
    await notifyPaymentCounterpart(admin, {
      applicationId: params.applicationId,
      studentProfileId: actor.application.student_profile_id,
      actorRole: actor.role,
      kind: "paid",
    });
  }
  return { ok: true, alreadyReported: false };
}

/** «No pude realizar el pago»: marca el aviso, frena el vencimiento hasta que la residencia responda y la avisa. Motivo opcional. */
export async function reportResidencePaymentIssueCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; reason?: unknown },
): Promise<ReportPaymentResult> {
  const reason = validateIssueReason(params.reason);
  if (!reason.ok) return { ok: false, error: reason.error };

  const ctx = await loadActiveContext(admin, params.actorUserId, params.applicationId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { actor, payment } = ctx;

  if (isPaymentIssueOpen(payment)) return { ok: true, alreadyReported: true };
  if (payment.status === "student_reported_paid") return { ok: false, error: "Ya avisaste que pagaste. La residencia lo tiene que confirmar." };
  if (payment.status !== "pending") return { ok: false, error: "Este pago ya no admite cambios. Si necesitás ayuda, escribile a Soporte." };

  const now = new Date().toISOString();
  // «Una sola marca por pago» (0102): un aviso nuevo tras una respuesta pisa el anterior y reabre el aviso.
  const { data: claimed, error: claimError } = await admin
    .from("external_residence_payments")
    .update({
      student_payment_issue_at: now,
      student_payment_issue_reason: reason.value,
      student_payment_issue_resolved_at: null,
      ...CLEAR_MARKS,
    })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (claimError || !claimed || claimed.length === 0) {
    if (claimError) {
      console.error("[payment-report] issue claim failed:", claimError.code, claimError.message);
      return { ok: false, error: SAVE_FAILED };
    }
    return { ok: false, error: "Este pago ya no admite cambios. Actualizá la página." };
  }

  const { data: still } = await admin.from("application_requests").select("status").eq("id", params.applicationId).maybeSingle();
  if (still && still.status !== "residence_payment_pending") {
    await admin
      .from("external_residence_payments")
      .update({ student_payment_issue_at: payment.student_payment_issue_at, student_payment_issue_reason: null, student_payment_issue_resolved_at: payment.student_payment_issue_resolved_at })
      .eq("id", payment.id);
    return { ok: false, error: NOT_PENDING };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: actor.role === "student" ? "student" : "family_member",
    action: "residence_payment_issue_reported",
    entityType: "application_requests",
    entityId: params.applicationId,
    newValue: { has_reason: reason.value !== null, reason_length: reason.value?.length ?? 0, reported_by: actor.role },
    source: "user",
  });
  await notifyResidencePaymentTeam(admin, {
    applicationId: params.applicationId,
    residenceId: actor.application.residence_id,
    kind: "student_payment_issue",
    isMinor: actor.isMinor,
  });
  if (actor.isMinor) {
    await notifyPaymentCounterpart(admin, {
      applicationId: params.applicationId,
      studentProfileId: actor.application.student_profile_id,
      actorRole: actor.role,
      kind: "issue",
    });
  }
  return { ok: true, alreadyReported: false };
}
