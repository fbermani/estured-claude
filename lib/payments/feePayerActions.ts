import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { validateIssueReason } from "@/lib/applications/paymentReportView";
import { resolveFeePayer } from "@/lib/payments/feePayerAccess";
import { loadOfferedFeeMethods } from "@/lib/payments/feeCollectionMethods";
import { buildFeeInstructionsSnapshot, feeAmountInCurrency, isFeeIssueOpen } from "@/lib/payments/feeCollection";
import { isPaymentMethodKey } from "@/lib/payments/paymentMethods";

/**
 * Acciones del PAGADOR del fee de EstuRed sobre el medio de pago y el aviso de problema (DR64 (b) y (e); `docs/07` §17.7 y §17.8).
 * Capa de negocio `(admin, params)`, sin `next/headers`: la usan las server actions de `app/students/applications/[id]/fee/`.
 *
 * Reglas comunes:
 *  - El actor sale de la BASE (`resolveFeePayer`): el pagador designado, que es el estudiante o su familiar con vínculo activo y
 *    `can_pay_estured_fee`. Todo lo demás recibe un error sin pista de si la solicitud existe.
 *  - Solo con el fee en `pending_payment_method` y el plazo vigente. NO cambia ningún estado de `docs/04` §8.
 *  - El cambio se reclama con un update condicional (estado, pagador y plazo); si no devuelve fila, no hay efectos.
 *  - Ni la auditoría ni los avisos llevan datos de cobro ni el texto libre del motivo.
 */

export type FeePayerActionResult = { ok: true } | { ok: false; error: string };
export type FeeIssueResult = { ok: true; alreadyReported: boolean } | { ok: false; error: string };

const SAVE_FAILED = "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.";
const EXPIRED = "El plazo para pagar este fee ya venció. Escribile a EstuRed desde Soporte.";
const ISSUE_OPEN = "Ya avisaste que no pudiste pagar. Esperá la respuesta de EstuRed: te avisamos por acá.";
const STALE = "El pago ya no se puede cambiar: cambió el pagador, venció el plazo o ya hay un aviso. Actualizá la página.";

function actorRole(role: "student" | "family_member"): "student" | "family_member" {
  return role === "student" ? "student" : "family_member";
}

/** Motivo por el que el fee no admite la acción del pagador, o `null` si la admite. */
export function feeStageBlocker(fee: { status: string; expires_at: string | null }, now: Date): string | null {
  if (fee.status === "pending_manual_payment") return "Ya informaste el pago. EstuRed lo está validando.";
  if (fee.status !== "pending_payment_method") return "Este pago ya no admite cambios. Si necesitás ayuda, escribile a EstuRed desde Soporte.";
  if (fee.expires_at && new Date(fee.expires_at).getTime() <= now.getTime()) return EXPIRED;
  return null;
}

/**
 * El pagador elige el medio de cobro (o lo cambia mientras no informe el pago). Congela `instructions_snapshot` con los datos de
 * ESE momento: si el admin cambia los datos después, este fee conserva los que vio el pagador.
 */
export async function chooseFeePaymentMethodCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; methodKey: unknown; now?: Date },
): Promise<FeePayerActionResult> {
  const now = params.now ?? new Date();
  const ctx = await resolveFeePayer(admin, params.actorUserId, params.applicationId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { fee } = ctx;

  const blocker = feeStageBlocker(fee, now);
  if (blocker) return { ok: false, error: blocker };
  if (isFeeIssueOpen(fee)) return { ok: false, error: ISSUE_OPEN };

  if (!isPaymentMethodKey(params.methodKey)) return { ok: false, error: "Elegí uno de los medios de la lista." };
  const offered = await loadOfferedFeeMethods(admin);
  if (!offered.ok) return { ok: false, error: "No pudimos leer los medios de pago. Probá de nuevo en unos minutos." };
  const method = offered.methods.find((m) => m.key === params.methodKey);
  if (!method) return { ok: false, error: "Ese medio no está habilitado. Actualizá la página y elegí otro." };

  const label = method.key === "other" ? method.label : null;
  const snapshot = buildFeeInstructionsSnapshot(method.key, { methodLabel: label, details: method.details });
  if (!snapshot.ok) return { ok: false, error: snapshot.error };

  // En USD el monto sale del tipo de cambio del snapshot de la solicitud (docs/04 §8.4); se persiste para que la validación del admin compare lo mismo.
  const patch: Record<string, unknown> = {
    chosen_method: method.key,
    payment_currency: method.currency,
    instructions_snapshot: snapshot.value,
  };
  if (method.currency === "USD") {
    const usd = feeAmountInCurrency(fee, "USD");
    if (usd === null) return { ok: false, error: "No pudimos calcular el monto en dólares. Elegí otro medio o escribile a EstuRed desde Soporte." };
    patch.fee_amount_usd = usd;
  }

  const base = admin
    .from("estured_fee_payments")
    .update(patch)
    .eq("id", fee.id)
    .eq("status", "pending_payment_method")
    .eq("payer_user_id", params.actorUserId)
    .gt("expires_at", now.toISOString());
  // Un aviso «No pude realizar el pago» que entró entre la lectura y este update tiene que frenar la elección.
  const { data: claimed, error } = await (fee.student_payment_issue_at ? base.eq("student_payment_issue_at", fee.student_payment_issue_at) : base.is("student_payment_issue_at", null)).select("id");
  if (error) {
    console.error("[fee-payer] choose method failed:", error.code, error.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: STALE };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: actorRole(ctx.role),
    action: "estured_fee_method_chosen",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    oldValue: { method_key: fee.chosen_method },
    newValue: { method_key: method.key, currency: method.currency, source: method.source },
    source: "user",
  });
  return { ok: true };
}

/**
 * «No pude realizar el pago» (DR64 (e)): marca el aviso, frena el vencimiento de 48 h hasta que el admin responda y avisa a los admin.
 * Motivo opcional (10 a 200 caracteres si se escribe). El fee sigue en `pending_payment_method`. Idempotente.
 */
export async function reportFeePaymentIssueCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; reason?: unknown; now?: Date },
): Promise<FeeIssueResult> {
  const now = params.now ?? new Date();
  const reason = validateIssueReason(params.reason);
  if (!reason.ok) return { ok: false, error: reason.error };

  const ctx = await resolveFeePayer(admin, params.actorUserId, params.applicationId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { fee } = ctx;

  if (fee.status === "pending_payment_method" && isFeeIssueOpen(fee)) return { ok: true, alreadyReported: true };
  const blocker = feeStageBlocker(fee, now);
  if (blocker) return { ok: false, error: blocker };

  // «Una sola marca por pago»: un aviso nuevo tras una respuesta pisa el anterior, reabre el aviso y limpia las marcas del job (DR64 (f)).
  const { data: claimed, error } = await admin
    .from("estured_fee_payments")
    .update({
      student_payment_issue_at: now.toISOString(),
      student_payment_issue_reason: reason.value,
      student_payment_issue_resolved_at: null,
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
    })
    .eq("id", fee.id)
    .eq("status", "pending_payment_method")
    .eq("payer_user_id", params.actorUserId)
    .gt("expires_at", now.toISOString())
    .select("id");
  if (error) {
    console.error("[fee-payer] issue claim failed:", error.code, error.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!claimed || claimed.length === 0) {
    // Otro toque lo reclamó antes, o el fee cambió: se vuelve a leer para contestar bien.
    const { data: again } = await admin
      .from("estured_fee_payments")
      .select("status, student_payment_issue_at, student_payment_issue_resolved_at")
      .eq("id", fee.id)
      .maybeSingle();
    if (again && again.status === "pending_payment_method" && isFeeIssueOpen(again as { student_payment_issue_at: string | null; student_payment_issue_resolved_at: string | null })) {
      return { ok: true, alreadyReported: true };
    }
    return { ok: false, error: STALE };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: actorRole(ctx.role),
    action: "estured_fee_payment_issue_reported",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    newValue: { has_reason: reason.value !== null, reason_length: reason.value?.length ?? 0, chosen_method: fee.chosen_method, reported_by: ctx.role },
    source: "user",
  });
  await notifyAdminsSafe(admin, {
    title: "Un pagador no pudo realizar el pago del fee",
    body: "Avisó que no pudo pagar el fee EstuRed. Respondele desde Pagos antes de que pase el plazo.",
    entityType: "estured_fee_payments",
    entityId: fee.id,
  });
  return { ok: true, alreadyReported: false };
}
