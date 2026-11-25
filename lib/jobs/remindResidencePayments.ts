import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { notifySuperadminsCounted } from "@/lib/notifications/notifySuperadminsCounted";
import { ESCALATION_HOURS } from "@/lib/payments/reopenCap";
import { loadStudentShortName } from "@/lib/family/notifyLinkedFamily";
import { isPaymentIssueOpen } from "@/lib/applications/paymentReportView";
import { notifyResidencePaymentTeam, notifyStudentAndFamily } from "@/lib/applications/paymentReportNotices";
import { openResidencePaymentSupportCase } from "@/lib/applications/residencePaymentSupportCase";

/**
 * Recordatorios y alerta del pago de la reserva a la residencia (DR63 (f), (j) 1 y (l); docs/07 §16.8). Corre dentro de
 * `runExpirationJobs` (cron horario). Todo IDEMPOTENTE: cada aviso se RECLAMA primero con un update condicional sobre su marca
 * (`*_sent_at is null`) y solo si devolvió la fila se envía; si el envío no se puede concretar, la marca se devuelve para reintentar.
 *
 *  - 24 h de «Ya pagué» (o de «No pude realizar el pago» sin responder) sin respuesta → aviso al equipo de la residencia.
 *  - 72 h de lo mismo → alerta al admin + caso de Soporte (`residence_payment`, abierto por el sistema a nombre del estudiante). NO hay
 *    transición automática a `disputed`.
 *  - 12 h antes de `payment_deadline_at`, solo con «Cobro con medios habilitados» y si el estudiante no avisó nada → aviso al
 *    estudiante (y a su familiar si es menor).
 *  - 7 días de lo mismo (DR66 (a)) → aviso in-app a TODOS los superadmin, una sola vez (`admin_escalated_at`). NO vence ni cambia de estado:
 *    es una pasada aparte, porque a los 7 días la alerta de 72 h ya salió y esas filas quedan fuera de la consulta de arriba.
 * Los avisos no llevan datos de cobro ni montos. Se limpian las marcas al registrar cada evento nuevo (acciones del estudiante y de la
 * residencia), así el segundo evento vuelve a tener sus avisos.
 */

const HOUR_MS = 3_600_000;
const RESIDENCE_REMINDER_HOURS = 24;
const ADMIN_ALERT_HOURS = 72;
const STUDENT_REMINDER_HOURS_BEFORE = 12;
const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

export type RemindResiduePaymentsResult = { residenceReminders: number; adminAlerts: number; studentReminders: number; superadminEscalations: number };

type Mark = "residence_reminder_sent_at" | "student_reminder_sent_at" | "admin_alert_sent_at" | "admin_escalated_at";

type PaymentRow = {
  id: string;
  application_request_id: string;
  residence_id: string;
  student_profile_id: string;
  status: string;
  student_reported_paid_at: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
  residence_reminder_sent_at: string | null;
  student_reminder_sent_at: string | null;
  admin_alert_sent_at: string | null;
  admin_escalated_at: string | null;
};
type AppRow = { id: string; status: string; residence_id: string; student_profile_id: string; contact_target: string | null; collection_mode: string | null; payment_deadline_at: string | null };

const PAYMENT_COLUMNS =
  "id, application_request_id, residence_id, student_profile_id, status, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at, residence_reminder_sent_at, student_reminder_sent_at, admin_alert_sent_at, admin_escalated_at";

/** Marca el aviso como enviado solo si seguía sin enviar. `true` = este proceso lo reclamó. */
async function claimMark(admin: SupabaseClient, paymentId: string, column: Mark, nowIso: string): Promise<boolean> {
  const { data, error } = await admin.from("external_residence_payments").update({ [column]: nowIso }).eq("id", paymentId).is(column, null).select("id");
  if (error) {
    console.error(`[jobs] remindResidencePayments (${column}) failed:`, error.code, error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}

async function releaseMark(admin: SupabaseClient, paymentId: string, column: Mark, onlyIfEquals?: string): Promise<void> {
  const query = admin.from("external_residence_payments").update({ [column]: null }).eq("id", paymentId);
  // Con `onlyIfEquals` la marca se devuelve solo si sigue siendo la de este proceso (un evento nuevo que la limpió no se pisa).
  await (onlyIfEquals ? query.eq(column, onlyIfEquals) : query);
}

/** Momento del evento abierto (el más reciente de los que importan) o `null` si no hay nada pendiente de respuesta. */
function openEventAt(p: PaymentRow): string | null {
  if (p.status === "student_reported_paid") return p.student_reported_paid_at;
  if (p.status === "pending" && isPaymentIssueOpen(p)) return p.student_payment_issue_at;
  return null;
}

export async function remindResidencePayments(admin: SupabaseClient, now: Date = new Date()): Promise<RemindResiduePaymentsResult> {
  const result: RemindResiduePaymentsResult = { residenceReminders: 0, adminAlerts: 0, studentReminders: 0, superadminEscalations: 0 };
  try {
    await runResidenceAndAdmin(admin, now, result);
    await runSuperadminEscalation(admin, now, result);
    await runStudentReminder(admin, now, result);
  } catch (error) {
    console.error("[jobs] remindResidencePayments threw:", error);
  }
  return result;
}

async function loadApps(admin: SupabaseClient, ids: string[]): Promise<Map<string, AppRow>> {
  const map = new Map<string, AppRow>();
  if (ids.length === 0) return map;
  const { data, error } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, contact_target, collection_mode, payment_deadline_at")
    .in("id", ids);
  if (error) {
    console.error("[jobs] remindResidencePayments (solicitudes) failed:", error.code, error.message);
    return map;
  }
  for (const a of (data ?? []) as AppRow[]) map.set(a.id, a);
  return map;
}

async function runResidenceAndAdmin(admin: SupabaseClient, now: Date, result: RemindResiduePaymentsResult): Promise<void> {
  // Mismos filtros que los índices parciales de 0102: aviso abierto, sin la alerta de 72 h enviada.
  const reported = await admin.from("external_residence_payments").select(PAYMENT_COLUMNS).eq("status", "student_reported_paid").is("admin_alert_sent_at", null);
  const issues = await admin
    .from("external_residence_payments")
    .select(PAYMENT_COLUMNS)
    .eq("status", "pending")
    .is("student_payment_issue_resolved_at", null)
    .is("admin_alert_sent_at", null);
  for (const read of [reported, issues]) {
    if (read.error) {
      if (!SCHEMA_MISSING_CODES.has(read.error.code ?? "")) console.error("[jobs] remindResidencePayments (avisos abiertos) failed:", read.error.code, read.error.message);
      return;
    }
  }
  const rows = [...((reported.data ?? []) as PaymentRow[]), ...((issues.data ?? []) as PaymentRow[])].filter((p) => openEventAt(p) !== null);
  if (rows.length === 0) return;
  const apps = await loadApps(admin, rows.map((p) => p.application_request_id));
  const nowIso = now.toISOString();

  for (const p of rows) {
    const app = apps.get(p.application_request_id);
    if (!app || app.status !== "residence_payment_pending") continue;
    const eventAt = new Date(openEventAt(p) as string).getTime();
    if (Number.isNaN(eventAt)) continue;
    const hours = (now.getTime() - eventAt) / HOUR_MS;
    const isReported = p.status === "student_reported_paid";
    const isMinor = app.contact_target === "family_member";

    if (hours >= RESIDENCE_REMINDER_HOURS && !p.residence_reminder_sent_at && (await claimMark(admin, p.id, "residence_reminder_sent_at", nowIso))) {
      const sent = await notifyResidencePaymentTeam(admin, {
        applicationId: app.id,
        residenceId: app.residence_id,
        kind: isReported ? "reminder_reported_paid" : "reminder_payment_issue",
        isMinor,
      });
      // Si el aviso no salió se devuelve la marca para reintentar en la próxima corrida (igual que la alerta de 72 h).
      if (sent) result.residenceReminders += 1;
      else await releaseMark(admin, p.id, "residence_reminder_sent_at");
    }

    if (hours >= ADMIN_ALERT_HOURS && !p.admin_alert_sent_at && (await claimMark(admin, p.id, "admin_alert_sent_at", nowIso))) {
      const sent = await alertAdmin(admin, p, app, isReported);
      if (sent) result.adminAlerts += 1;
      else await releaseMark(admin, p.id, "admin_alert_sent_at");
    }
  }
}

/**
 * DR66 (a): a los 7 días de un aviso sin respuesta («Ya pagué» sin confirmar o «No pude realizar el pago» sin responder) se avisa a todos los
 * superadmin, una sola vez. NO filtra por `admin_alert_sent_at` (a los 7 días la alerta de 72 h ya salió); sí por `admin_escalated_at`.
 * Un pago en `disputed` queda fuera (ya lo atiende Soporte). No cambia ningún estado ni plazo.
 */
async function runSuperadminEscalation(admin: SupabaseClient, now: Date, result: RemindResiduePaymentsResult): Promise<void> {
  const reported = await admin.from("external_residence_payments").select(PAYMENT_COLUMNS).eq("status", "student_reported_paid").is("admin_escalated_at", null);
  const issues = await admin
    .from("external_residence_payments")
    .select(PAYMENT_COLUMNS)
    .eq("status", "pending")
    .is("student_payment_issue_resolved_at", null)
    .is("admin_escalated_at", null);
  for (const read of [reported, issues]) {
    if (read.error) {
      if (!SCHEMA_MISSING_CODES.has(read.error.code ?? "")) console.error("[jobs] remindResidencePayments (escalado) failed:", read.error.code, read.error.message);
      return;
    }
  }
  const rows = [...((reported.data ?? []) as PaymentRow[]), ...((issues.data ?? []) as PaymentRow[])].filter((p) => {
    const at = openEventAt(p);
    return at !== null && (now.getTime() - new Date(at).getTime()) / HOUR_MS >= ESCALATION_HOURS;
  });
  if (rows.length === 0) return;
  const apps = await loadApps(admin, rows.map((p) => p.application_request_id));
  const nowIso = now.toISOString();

  for (const p of rows) {
    const app = apps.get(p.application_request_id);
    if (!app || app.status !== "residence_payment_pending") continue;
    if (!(await claimMark(admin, p.id, "admin_escalated_at", nowIso))) continue;
    const isReported = p.status === "student_reported_paid";
    const sent = await notifySuperadminsCounted(admin, {
      title: "Pago a la residencia sin respuesta hace 7 días",
      body: isReported
        ? "Hace 7 días un estudiante avisó que pagó la reserva y la residencia no respondió. El pago no vence. Resolvelo desde Soporte."
        : "Hace 7 días un estudiante avisó que no pudo pagar la reserva y la residencia no respondió. El pago no vence. Resolvelo desde Soporte.",
      entityType: "application_requests",
      entityId: app.id,
    });
    if (!sent) {
      await releaseMark(admin, p.id, "admin_escalated_at", nowIso);
      continue;
    }
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "residence_payment_escalated_to_superadmin",
      entityType: "application_requests",
      entityId: app.id,
      newValue: { payment_status: p.status },
      source: "system",
      isSystemAction: true,
    });
    result.superadminEscalations += 1;
  }
}

/** Alerta al admin + caso de Soporte. `false` = no se pudo y conviene reintentar (se devuelve la marca). */
async function alertAdmin(admin: SupabaseClient, p: PaymentRow, app: AppRow, isReported: boolean): Promise<boolean> {
  const { data: profile } = await admin.from("student_profiles").select("user_id").eq("id", app.student_profile_id).maybeSingle();
  const studentUserId = (profile?.user_id as string | undefined) ?? null;
  const description = isReported
    ? "El estudiante avisó hace más de 72 horas que pagó la reserva y la residencia todavía no respondió. Soporte revisa el caso."
    : "El estudiante avisó hace más de 72 horas que no pudo pagar la reserva y la residencia todavía no respondió. Soporte revisa el caso.";

  const supportCase = studentUserId
    ? await openResidencePaymentSupportCase(admin, {
        applicationId: app.id,
        residenceId: app.residence_id,
        openedByUserId: studentUserId,
        openedByRole: "system",
        description,
        auditSource: "system",
      })
    : ({ ok: false, schemaMissing: false } as const);
  if (!supportCase.ok && !supportCase.schemaMissing) return false;

  if (!supportCase.ok || !supportCase.created) {
    // Sin caso nuevo (0103 sin aplicar, o ya había uno abierto) el admin igual recibe la alerta.
    await notifyAdminsSafe(admin, {
      title: "Pago a la residencia sin confirmar",
      body: "Pasaron más de 72 horas y la residencia no respondió al aviso de un estudiante. Revisalo en Soporte.",
      entityType: "application_requests",
      entityId: app.id,
    });
  }
  await createAuditLog(admin, {
    actorUserId: null,
    actorRole: "system",
    action: "residence_payment_unanswered_alert",
    entityType: "application_requests",
    entityId: app.id,
    newValue: { payment_status: p.status, support_case_id: supportCase.ok ? supportCase.supportCaseId : null },
    source: "system",
    isSystemAction: true,
  });
  return true;
}

async function runStudentReminder(admin: SupabaseClient, now: Date, result: RemindResiduePaymentsResult): Promise<void> {
  const nowIso = now.toISOString();
  const limitIso = new Date(now.getTime() + STUDENT_REMINDER_HOURS_BEFORE * HOUR_MS).toISOString();
  const { data: appData, error } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, contact_target, collection_mode, payment_deadline_at")
    .eq("status", "residence_payment_pending")
    .eq("collection_mode", "enabled_methods")
    .gt("payment_deadline_at", nowIso)
    .lte("payment_deadline_at", limitIso);
  if (error) {
    if (!SCHEMA_MISSING_CODES.has(error.code ?? "")) console.error("[jobs] remindResidencePayments (plazo) failed:", error.code, error.message);
    return;
  }
  const apps = (appData ?? []) as AppRow[];
  if (apps.length === 0) return;

  const { data: paymentData, error: paymentError } = await admin
    .from("external_residence_payments")
    .select(PAYMENT_COLUMNS)
    .in("application_request_id", apps.map((a) => a.id));
  if (paymentError) {
    if (!SCHEMA_MISSING_CODES.has(paymentError.code ?? "")) console.error("[jobs] remindResidencePayments (pagos) failed:", paymentError.code, paymentError.message);
    return;
  }
  const paymentByApp = new Map(((paymentData ?? []) as PaymentRow[]).map((p) => [p.application_request_id, p]));

  for (const app of apps) {
    const p = paymentByApp.get(app.id);
    // Solo si todavía no informó el pago ni avisó un problema.
    if (!p || (p.status !== "pending" && p.status !== "student_reference_uploaded")) continue;
    if (p.student_reported_paid_at || isPaymentIssueOpen(p) || p.student_reminder_sent_at) continue;
    if (!(await claimMark(admin, p.id, "student_reminder_sent_at", nowIso))) continue;

    const { data: residence } = await admin.from("residences").select("name").eq("id", app.residence_id).maybeSingle();
    const residenceName = (residence?.name as string | undefined) ?? "la residencia";
    const isMinor = app.contact_target === "family_member";
    const studentName = isMinor ? await loadStudentShortName(admin, app.student_profile_id) : "el estudiante";
    const tail = "Si ya pagaste, tocá «Ya pagué» en la solicitud; si no pudiste, avisalo ahí. La solicitud sigue sujeta a confirmación.";
    await notifyStudentAndFamily(admin, {
      applicationId: app.id,
      studentProfileId: app.student_profile_id,
      student: { title: "Tu plazo para pagar la reserva vence pronto", body: `Te quedan menos de 12 horas para pagar la reserva en ${residenceName}. ${tail}` },
      family: isMinor
        ? { title: `Vence pronto el plazo de pago de ${studentName}`, body: `Quedan menos de 12 horas para pagar la reserva en ${residenceName}. ${tail}` }
        : null,
    });
    result.studentReminders += 1;
  }
}
