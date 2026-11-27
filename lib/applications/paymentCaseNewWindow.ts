import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { loadStudentShortName } from "@/lib/family/notifyLinkedFamily";
import { paymentHoldsDeadline } from "@/lib/applications/paymentReportView";
import {
  NEW_WINDOW_HOURS,
  NEW_WINDOW_START_STAGE,
  newWindowResidenceCopy,
  newWindowStudentCopy,
  shouldOpenNewWindow,
} from "@/lib/applications/paymentDeadlineAlerts";
import { deliverResidenceNotice, deliverStudentSideNotice } from "@/lib/applications/paymentDeadlineNotices";

/**
 * DR73 (c): al cerrar un caso de Soporte de pago con el plazo vencido y sin «Pago recibido», corre un plazo nuevo de 24 h. Solo si nada
 * más frena el plazo («Ya pagué» o un problema de pago abierto; supuesto reversible).
 *
 * Orden (supuesto reversible, docs/00 DR73): el plazo se extiende ANTES de cerrar el caso (mientras el caso sigue abierto el job no vence
 * la solicitud). Si el cierre falla, `rollbackNewPaymentWindow` lo deshace. Recién con el caso cerrado se avisa (`announceNewPaymentWindow`).
 */

export type PreparedNewWindow =
  | { kind: "none" }
  | { kind: "error" }
  | {
      kind: "applied";
      applicationId: string;
      residenceId: string;
      studentProfileId: string;
      isMinor: boolean;
      previousDeadline: string;
      deadline: string;
    };

export async function prepareNewPaymentWindow(admin: SupabaseClient, applicationId: string, now: Date = new Date()): Promise<PreparedNewWindow> {
  const { data: app, error } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, contact_target, payment_deadline_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    console.error("[payment-new-window] application read failed:", error.code, error.message);
    return { kind: "error" };
  }
  if (!app) return { kind: "none" };

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("id, status, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (paymentError) {
    console.error("[payment-new-window] payment read failed:", paymentError.code, paymentError.message);
    return { kind: "error" };
  }
  const heldByPayment = payment ? paymentHoldsDeadline(payment) : false;
  if (!shouldOpenNewWindow({ applicationStatus: app.status as string, deadlineIso: app.payment_deadline_at as string | null, now, heldByPayment })) {
    return { kind: "none" };
  }

  const previousDeadline = app.payment_deadline_at as string;
  const deadline = new Date(now.getTime() + NEW_WINDOW_HOURS * 3_600_000).toISOString();
  const { data: updated, error: updateError } = await admin
    .from("application_requests")
    .update({ payment_deadline_at: deadline })
    .eq("id", applicationId)
    .eq("status", "residence_payment_pending")
    .eq("payment_deadline_at", previousDeadline)
    .select("id");
  if (updateError) {
    console.error("[payment-new-window] deadline update failed:", updateError.code, updateError.message);
    return { kind: "error" };
  }
  if (!updated || updated.length === 0) return { kind: "none" };

  // Las alertas de 36 y 24 h no corresponden en el plazo nuevo (lo reemplaza el aviso del plazo nuevo). Sin 0112, se sigue sin marca.
  if (payment) {
    const { error: markError } = await admin
      .from("external_residence_payments")
      .update({ deadline_alert_stage: NEW_WINDOW_START_STAGE, deadline_alert_for: deadline })
      .eq("id", payment.id);
    if (markError) console.error("[payment-new-window] alert mark failed:", markError.code);
  }

  return {
    kind: "applied",
    applicationId,
    residenceId: app.residence_id as string,
    studentProfileId: app.student_profile_id as string,
    isMinor: app.contact_target === "family_member",
    previousDeadline,
    deadline,
  };
}

/** El cierre del caso falló: vuelve el plazo anterior (solo si sigue siendo el que puso este proceso). */
export async function rollbackNewPaymentWindow(admin: SupabaseClient, prepared: PreparedNewWindow): Promise<void> {
  if (prepared.kind !== "applied") return;
  const { error } = await admin
    .from("application_requests")
    .update({ payment_deadline_at: prepared.previousDeadline })
    .eq("id", prepared.applicationId)
    .eq("payment_deadline_at", prepared.deadline);
  if (error) console.error("[payment-new-window] rollback failed:", error.code, error.message);
}

/** Con el caso ya cerrado: avisa al estudiante (y familiar) y a la residencia, y deja auditoría. */
export async function announceNewPaymentWindow(
  admin: SupabaseClient,
  prepared: PreparedNewWindow,
  params: { actorUserId: string; actorRole: string; supportCaseId: string },
): Promise<void> {
  if (prepared.kind !== "applied") return;
  try {
    const { data: residence } = await admin.from("residences").select("name").eq("id", prepared.residenceId).maybeSingle();
    const residenceName = (residence?.name as string | undefined) ?? "la residencia";
    const studentName = await loadStudentShortName(admin, prepared.studentProfileId);
    await deliverStudentSideNotice(admin, {
      applicationId: prepared.applicationId,
      studentProfileId: prepared.studentProfileId,
      isMinor: prepared.isMinor,
      build: (audience) => newWindowStudentCopy({ audience, residenceName, studentName, deadlineIso: prepared.deadline }),
    });
    await deliverResidenceNotice(admin, {
      applicationId: prepared.applicationId,
      residenceId: prepared.residenceId,
      copy: newWindowResidenceCopy({ studentName, deadlineIso: prepared.deadline }),
    });
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "residence_payment_new_window_after_support_case",
      entityType: "application_requests",
      entityId: prepared.applicationId,
      oldValue: { payment_deadline_at: prepared.previousDeadline },
      newValue: { payment_deadline_at: prepared.deadline, support_case_id: params.supportCaseId },
      source: "admin",
    });
  } catch (error) {
    console.error("[payment-new-window] announce failed:", error);
  }
}
