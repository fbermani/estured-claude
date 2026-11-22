import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { isFeeIssueOpen } from "@/lib/payments/feeCollection";
import { loadOfferedFeeMethods } from "@/lib/payments/feeCollectionMethods";
import { notifyFeePayer } from "@/lib/payments/feePayerNotices";
import { openFeeReviewSupportCase } from "@/lib/payments/feeSupportCase";

/**
 * Recordatorios y alerta del fee de EstuRed (DR64 (f); `docs/07` §17.10). Corre dentro de `runExpirationJobs` (cron horario). IDEMPOTENTE:
 * cada aviso se RECLAMA primero con un update condicional sobre su marca (`*_sent_at is null`) y solo si devolvió la fila se envía; si el
 * envío no se puede intentar (no hay a quién avisar, o el caso de Soporte no se pudo abrir), la marca se devuelve para reintentar.
 *
 *  - 12 h antes de `expires_at`, en `pending_payment_method`, sin «Ya pagué» ni aviso abierto y con medios para ofrecer → al pagador.
 *  - 24 h de «Ya pagué» sin validar ni disputa, o de «No pude realizar el pago» sin responder → a los admin.
 *  - 72 h de lo mismo → alerta a los admin + caso de Soporte `estured_fee_payment` (único por reserva; en una renovación no hay reserva a la que
 *    atarlo y solo sale la alerta; supuesto reversible). Sin transición automática ni vencimiento: quien no responde es EstuRed.
 * Los avisos no llevan datos de cobro ni montos. El servidor limpia las tres marcas en cada evento nuevo (nuevo «Ya pagué» o aviso).
 */

const HOUR_MS = 3_600_000;
const ADMIN_REMINDER_HOURS = 24;
const ADMIN_ALERT_HOURS = 72;
const PAYER_REMINDER_HOURS_BEFORE = 12;
/** Columna o tabla inexistente: la migración 0105 todavía no está aplicada en ese entorno. */
const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

export type RemindFeePaymentsResult = { payerReminders: number; adminReminders: number; adminAlerts: number };

type Mark = "payer_reminder_sent_at" | "admin_reminder_sent_at" | "admin_alert_sent_at";

type FeeRow = {
  id: string;
  status: string;
  reservation_id: string | null;
  renewal_offer_id: string | null;
  payer_user_id: string;
  expires_at: string | null;
  student_reported_paid_at: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
  admin_disputed_at: string | null;
  payer_reminder_sent_at: string | null;
  admin_reminder_sent_at: string | null;
  admin_alert_sent_at: string | null;
};
const COLUMNS =
  "id, status, reservation_id, renewal_offer_id, payer_user_id, expires_at, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at, admin_disputed_at, payer_reminder_sent_at, admin_reminder_sent_at, admin_alert_sent_at";

/** Marca el aviso como enviado solo si seguía sin enviar. `true` = este proceso lo reclamó. */
async function claimMark(admin: SupabaseClient, feeId: string, column: Mark, nowIso: string): Promise<boolean> {
  const { data, error } = await admin.from("estured_fee_payments").update({ [column]: nowIso }).eq("id", feeId).is(column, null).select("id");
  if (error) {
    console.error(`[jobs] remindFeePayments (${column}) failed:`, error.code, error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}

/** Devuelve la marca solo si sigue siendo la que puso este proceso (un evento nuevo que la limpió no se pisa). */
async function releaseMark(admin: SupabaseClient, feeId: string, column: Mark, nowIso: string): Promise<void> {
  await admin.from("estured_fee_payments").update({ [column]: null }).eq("id", feeId).eq(column, nowIso);
}

/** Aviso a todos los admin/superadmin. `false` si no hay a quién avisar o no se pudo leer (el llamador devuelve la marca). */
async function notifyAdminsCounted(admin: SupabaseClient, params: { title: string; body: string; entityType: string; entityId: string }): Promise<boolean> {
  try {
    const { data, error } = await admin.from("user_roles").select("user_id").in("role", ["admin", "superadmin"]);
    if (error) return false;
    const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
    if (ids.length === 0) return false;
    await Promise.all(
      ids.map((userId) =>
        createNotification(admin, {
          userId,
          title: params.title,
          body: params.body,
          relatedEntityType: params.entityType,
          relatedEntityId: params.entityId,
          category: "admin_requests",
        }),
      ),
    );
    return true;
  } catch (error) {
    console.error("[jobs] remindFeePayments notifyAdminsCounted failed:", error);
    return false;
  }
}

/** Momento del evento abierto que espera respuesta de EstuRed, o `null` si no hay ninguno. */
export function openFeeEventAt(f: Pick<FeeRow, "status" | "student_reported_paid_at" | "student_payment_issue_at" | "student_payment_issue_resolved_at" | "admin_disputed_at">): string | null {
  if (f.status === "pending_manual_payment" && !f.admin_disputed_at) return f.student_reported_paid_at;
  if (f.status === "pending_payment_method" && isFeeIssueOpen(f)) return f.student_payment_issue_at;
  return null;
}

export async function remindFeePayments(admin: SupabaseClient, now: Date = new Date()): Promise<RemindFeePaymentsResult> {
  const result: RemindFeePaymentsResult = { payerReminders: 0, adminReminders: 0, adminAlerts: 0 };
  try {
    await runAdminReminders(admin, now, result);
    await runPayerReminders(admin, now, result);
  } catch (error) {
    console.error("[jobs] remindFeePayments threw:", error);
  }
  return result;
}

async function runAdminReminders(admin: SupabaseClient, now: Date, result: RemindFeePaymentsResult): Promise<void> {
  // Mismos filtros que los índices parciales de 0105: evento abierto y sin la alerta de 72 h enviada.
  const reported = await admin.from("estured_fee_payments").select(COLUMNS).eq("status", "pending_manual_payment").is("admin_disputed_at", null).is("admin_alert_sent_at", null);
  const issues = await admin.from("estured_fee_payments").select(COLUMNS).eq("status", "pending_payment_method").is("student_payment_issue_resolved_at", null).is("admin_alert_sent_at", null);
  for (const read of [reported, issues]) {
    if (read.error) {
      if (!SCHEMA_MISSING_CODES.has(read.error.code ?? "")) console.error("[jobs] remindFeePayments (avisos abiertos) failed:", read.error.code, read.error.message);
      return;
    }
  }
  const rows = [...((reported.data ?? []) as FeeRow[]), ...((issues.data ?? []) as FeeRow[])].filter((f) => openFeeEventAt(f) !== null);
  const nowIso = now.toISOString();

  for (const f of rows) {
    const eventAt = new Date(openFeeEventAt(f) as string).getTime();
    if (Number.isNaN(eventAt)) continue;
    const hours = (now.getTime() - eventAt) / HOUR_MS;
    const isReported = f.status === "pending_manual_payment";
    // El clic de la campana abre la cola de validación (`/admin/payments`), no la ficha de la reserva.
    const entity = { entityType: "estured_fee_payments", entityId: f.id };

    if (hours >= ADMIN_REMINDER_HOURS && !f.admin_reminder_sent_at && (await claimMark(admin, f.id, "admin_reminder_sent_at", nowIso))) {
      const sent = await notifyAdminsCounted(admin, {
        title: isReported ? "Tenés un pago del fee por validar" : "Un pagador espera tu respuesta",
        body: isReported
          ? "Hace más de 24 horas que un pagador informó el pago del fee EstuRed y sigue sin validar. Revisalo en Pagos."
          : "Hace más de 24 horas que un pagador avisó que no pudo pagar el fee EstuRed. Respondele desde Pagos.",
        ...entity,
      });
      if (sent) result.adminReminders += 1;
      else await releaseMark(admin, f.id, "admin_reminder_sent_at", nowIso);
    }

    if (hours >= ADMIN_ALERT_HOURS && !f.admin_alert_sent_at && (await claimMark(admin, f.id, "admin_alert_sent_at", nowIso))) {
      const done = await alertAdmins(admin, f, isReported, entity);
      if (done) result.adminAlerts += 1;
      else await releaseMark(admin, f.id, "admin_alert_sent_at", nowIso);
    }
  }
}

/** Alerta a los admin + caso de Soporte (solo reservas). `false` = no se pudo y conviene reintentar. */
async function alertAdmins(admin: SupabaseClient, f: FeeRow, isReported: boolean, entity: { entityType: string; entityId: string }): Promise<boolean> {
  let supportCaseId: string | null = null;
  if (f.reservation_id) {
    const supportCase = await openFeeReviewSupportCase(admin, {
      reservationId: f.reservation_id,
      payerUserId: f.payer_user_id,
      description: isReported
        ? "El pagador informó hace más de 72 horas el pago del fee EstuRed y todavía no se validó. Soporte revisa el caso."
        : "El pagador avisó hace más de 72 horas que no pudo pagar el fee EstuRed y todavía no se respondió. Soporte revisa el caso.",
      actorUserId: null,
      actorRole: "system",
    });
    if (!supportCase.ok) return false;
    supportCaseId = supportCase.supportCaseId;
  }
  const notified = await notifyAdminsCounted(admin, {
    title: "Pago del fee sin resolver hace más de 72 horas",
    body: "Un pagador espera hace más de 72 horas la validación o respuesta de EstuRed sobre el fee. Revisalo en Pagos y en Soporte.",
    ...entity,
  });
  if (!notified) return false;
  await createAuditLog(admin, {
    actorUserId: null,
    actorRole: "system",
    action: "estured_fee_unanswered_alert",
    entityType: "estured_fee_payments",
    entityId: f.id,
    newValue: { fee_status: f.status, support_case_id: supportCaseId },
    source: "system",
    isSystemAction: true,
  });
  return true;
}

async function runPayerReminders(admin: SupabaseClient, now: Date, result: RemindFeePaymentsResult): Promise<void> {
  const nowIso = now.toISOString();
  const limitIso = new Date(now.getTime() + PAYER_REMINDER_HOURS_BEFORE * HOUR_MS).toISOString();
  const { data, error } = await admin
    .from("estured_fee_payments")
    .select(COLUMNS)
    .eq("status", "pending_payment_method")
    .is("payer_reminder_sent_at", null)
    .gt("expires_at", nowIso)
    .lte("expires_at", limitIso);
  if (error) {
    if (!SCHEMA_MISSING_CODES.has(error.code ?? "")) console.error("[jobs] remindFeePayments (plazo) failed:", error.code, error.message);
    return;
  }
  const rows = ((data ?? []) as FeeRow[]).filter((f) => !f.student_reported_paid_at && !isFeeIssueOpen(f));
  if (rows.length === 0) return;

  // Solo se recuerda pagar si hay medios para ofrecer (los de la tabla o el respaldo de `payment_settings`).
  const offered = await loadOfferedFeeMethods(admin);
  if (!offered.ok || offered.methods.length === 0) return;

  for (const f of rows) {
    if (!(await claimMark(admin, f.id, "payer_reminder_sent_at", nowIso))) continue;
    const related = f.reservation_id
      ? ({ type: "reservations", id: f.reservation_id } as const)
      : f.renewal_offer_id
        ? ({ type: "renewal_offers", id: f.renewal_offer_id } as const)
        : null;
    if (!related || !f.payer_user_id) {
      await releaseMark(admin, f.id, "payer_reminder_sent_at", nowIso);
      continue;
    }
    await notifyFeePayer(admin, { payerUserId: f.payer_user_id, kind: "reminder_12h", related });
    result.payerReminders += 1;
  }
}
