import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string; actorRole: string; source?: string }[]);
vi.mock("@/lib/audit", () => ({ createAuditLog: async (_a: unknown, e: { action: string; actorRole: string; source?: string }) => (audits.push(e), true) }));
const adminNotices = vi.hoisted(() => [] as { title: string; entityType: string }[]);
vi.mock("@/lib/notifications/notifyAdminsSafe", () => ({ notifyAdminsSafe: async (_a: unknown, p: { title: string; entityType: string }) => void adminNotices.push(p) }));
const residenceNotices = vi.hoisted(() => [] as { applicationId: string; kind: string; isMinor: boolean }[]);
const noticeControl = vi.hoisted(() => ({ fail: false }));
const studentNotices = vi.hoisted(() => [] as { applicationId: string; student: { title: string; body: string }; family: unknown }[]);
vi.mock("@/lib/applications/paymentReportNotices", () => ({
  notifyResidencePaymentTeam: async (_a: unknown, p: { applicationId: string; kind: string; isMinor: boolean }) => (noticeControl.fail ? false : (residenceNotices.push(p), true)),
  notifyStudentAndFamily: async (_a: unknown, p: { applicationId: string; student: { title: string; body: string }; family: unknown }) => void studentNotices.push(p),
}));
const superNotices = vi.hoisted(() => [] as { title: string; entityType: string; entityId: string }[]);
const superControl = vi.hoisted(() => ({ recipients: true }));
vi.mock("@/lib/notifications/notifySuperadminsCounted", () => ({
  notifySuperadminsCounted: async (_a: unknown, p: { title: string; entityType: string; entityId: string }) => (superControl.recipients ? (superNotices.push(p), true) : false),
}));
vi.mock("@/lib/family/notifyLinkedFamily", () => ({ loadStudentShortName: async () => "Valentina R." }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { remindResidencePayments } from "@/lib/jobs/remindResidencePayments";

/** DR63 (f), (j) 1 y (l): recordatorios 24 h / 12 h y alerta de 72 h. Idempotentes: cada aviso se reclama con su marca. */
const NOW = new Date("2026-11-21T12:00:00.000Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const ahead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

function app(id: string, over: Row = {}): Row {
  return { id, status: "residence_payment_pending", residence_id: "res-1", student_profile_id: `sp-${id}`, contact_target: "student", collection_mode: "enabled_methods", payment_deadline_at: ahead(40), ...over };
}
function payment(appId: string, over: Row = {}): Row {
  return {
    id: `pay-${appId}`,
    application_request_id: appId,
    residence_id: "res-1",
    student_profile_id: `sp-${appId}`,
    status: "pending",
    student_reported_paid_at: null,
    student_payment_issue_at: null,
    student_payment_issue_resolved_at: null,
    residence_reminder_sent_at: null,
    student_reminder_sent_at: null,
    admin_alert_sent_at: null,
    admin_escalated_at: null,
    reopen_count: 0,
    ...over,
  };
}
const reported = (hoursAgo: number, over: Row = {}): Row => ({ status: "student_reported_paid", student_reported_paid_at: ago(hoursAgo), ...over });

let fake: ReturnType<typeof createInMemorySupabase>;
const pay = (appId: string) => fake.tables.external_residence_payments.find((p) => p.application_request_id === appId)!;
function boot(apps: Row[], payments: Row[], opts = {}) {
  fake = createInMemorySupabase(
    {
      application_requests: apps,
      external_residence_payments: payments,
      student_profiles: apps.map((a) => ({ id: a.student_profile_id, user_id: `u-${a.id}` })),
      residences: [{ id: "res-1", name: "Norte" }],
      support_cases: [],
    },
    opts,
  );
}

beforeEach(() => {
  audits.length = 0;
  adminNotices.length = 0;
  residenceNotices.length = 0;
  studentNotices.length = 0;
  noticeControl.fail = false;
  superNotices.length = 0;
  superControl.recipients = true;
});

describe("aviso a la residencia a las 24 h", () => {
  it("avisa «Ya pagué» sin respuesta y marca residence_reminder_sent_at; antes de las 24 h no", async () => {
    boot([app("a"), app("young")], [payment("a", reported(25)), payment("young", reported(23))]);
    const res = await remindResidencePayments(fake.client, NOW);
    expect(res).toMatchObject({ residenceReminders: 1, adminAlerts: 0 });
    expect(residenceNotices).toEqual([{ applicationId: "a", residenceId: "res-1", kind: "reminder_reported_paid", isMinor: false }]);
    expect(pay("a").residence_reminder_sent_at).toBe(NOW.toISOString());
    expect(pay("young").residence_reminder_sent_at).toBeNull();
  });

  it("si el aviso falla, devuelve la marca de 24 h y reintenta en la próxima corrida", async () => {
    boot([app("f")], [payment("f", reported(25))]);
    noticeControl.fail = true;
    const first = await remindResidencePayments(fake.client, NOW);
    expect(first.residenceReminders).toBe(0);
    expect(pay("f").residence_reminder_sent_at).toBeNull();
    noticeControl.fail = false;
    const second = await remindResidencePayments(fake.client, NOW);
    expect(second.residenceReminders).toBe(1);
    expect(pay("f").residence_reminder_sent_at).toBe(NOW.toISOString());
  });

  it("también para «No pude realizar el pago» sin responder", async () => {
    boot([app("i")], [payment("i", { student_payment_issue_at: ago(30) })]);
    await remindResidencePayments(fake.client, NOW);
    expect(residenceNotices).toEqual([expect.objectContaining({ kind: "reminder_payment_issue" })]);
  });

  it("es idempotente: la segunda corrida no vuelve a avisar", async () => {
    boot([app("a")], [payment("a", reported(25))]);
    await remindResidencePayments(fake.client, NOW);
    residenceNotices.length = 0;
    const second = await remindResidencePayments(fake.client, new Date(NOW.getTime() + 3_600_000));
    expect(second.residenceReminders).toBe(0);
    expect(residenceNotices).toEqual([]);
  });

  it("no avisa si la residencia ya respondió (pago recibido, disputado, aviso resuelto) o la solicitud ya no espera el pago", async () => {
    boot(
      [app("recv"), app("disp"), app("res"), app("closed", { status: "expired_no_student_payment" })],
      [
        payment("recv", reported(30, { status: "reported_received_by_residence" })),
        payment("disp", reported(30, { status: "disputed" })),
        payment("res", { student_payment_issue_at: ago(30), student_payment_issue_resolved_at: ago(2) }),
        payment("closed", reported(30)),
      ],
    );
    expect(await remindResidencePayments(fake.client, NOW)).toEqual({ residenceReminders: 0, adminAlerts: 0, studentReminders: 0, superadminEscalations: 0 });
    expect(residenceNotices).toEqual([]);
  });
});

describe("alerta al admin a las 72 h", () => {
  it("avisa al admin, abre el caso de Soporte (a nombre del estudiante, rol system) y marca admin_alert_sent_at; no pasa a disputed", async () => {
    boot([app("a")], [payment("a", reported(73))]);
    const res = await remindResidencePayments(fake.client, NOW);
    expect(res.adminAlerts).toBe(1);
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(fake.tables.support_cases[0]).toMatchObject({ topic: "residence_payment", residence_id: "res-1", related_entity_type: "application_requests", related_entity_id: "a", opened_by_user_id: "u-a", opened_by_role: "system", terms_reminder_accepted_at: null });
    expect(adminNotices.map((n) => n.entityType)).toEqual(["support_cases"]);
    expect(pay("a")).toMatchObject({ status: "student_reported_paid", admin_alert_sent_at: NOW.toISOString() });
    expect(audits.map((a) => a.action)).toContain("residence_payment_unanswered_alert");
    expect(fake.tables.application_requests[0].status).toBe("residence_payment_pending");
  });

  it("es idempotente: una segunda corrida no duplica el caso ni el aviso", async () => {
    boot([app("a")], [payment("a", reported(80))]);
    await remindResidencePayments(fake.client, NOW);
    adminNotices.length = 0;
    await remindResidencePayments(fake.client, new Date(NOW.getTime() + 3_600_000));
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(adminNotices).toEqual([]);
  });

  it("no abre un segundo caso si ya hay uno abierto para la solicitud; el admin igual recibe la alerta", async () => {
    boot([app("a")], [payment("a", reported(80))]);
    fake.tables.support_cases.push({ id: "c1", topic: "residence_payment", related_entity_id: "a", status: "opened" });
    await remindResidencePayments(fake.client, NOW);
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(adminNotices.map((n) => n.title)).toEqual(["Pago a la residencia sin confirmar"]);
  });

  it("con «No pude realizar el pago» sin responder también alerta; sin la migración 0103 solo avisa al admin", async () => {
    boot([app("i")], [payment("i", { student_payment_issue_at: ago(75) })], { failInsert: { support_cases: { code: "23514", message: "check" } } });
    const res = await remindResidencePayments(fake.client, NOW);
    expect(res.adminAlerts).toBe(1);
    expect(fake.tables.support_cases).toHaveLength(0);
    expect(adminNotices.map((n) => n.entityType)).toEqual(["application_requests"]);
  });

  it("si el caso falla por otra causa se devuelve la marca para reintentar", async () => {
    boot([app("a")], [payment("a", reported(80))], { failInsert: { support_cases: { code: "XX000", message: "boom" } } });
    const res = await remindResidencePayments(fake.client, NOW);
    expect(res.adminAlerts).toBe(0);
    expect(pay("a").admin_alert_sent_at).toBeNull();
  });
});

describe("recordatorio al estudiante 12 h antes del plazo", () => {
  it("avisa solo con medios habilitados, dentro de las 12 h y sin «Ya pagué» ni aviso de problema", async () => {
    boot(
      [
        app("due", { payment_deadline_at: ahead(10) }),
        app("far", { payment_deadline_at: ahead(20) }),
        app("past", { payment_deadline_at: ago(1) }),
        app("wa", { payment_deadline_at: ahead(10), collection_mode: "whatsapp_direct" }),
        app("paid", { payment_deadline_at: ahead(10) }),
        app("issue", { payment_deadline_at: ahead(10) }),
        app("done", { payment_deadline_at: ahead(10) }),
      ],
      [
        payment("due"),
        payment("far"),
        payment("past"),
        payment("wa"),
        payment("paid", reported(1)),
        payment("issue", { student_payment_issue_at: ago(1) }),
        payment("done", { student_reminder_sent_at: ago(1) }),
      ],
    );
    const res = await remindResidencePayments(fake.client, NOW);
    expect(res.studentReminders).toBe(1);
    expect(studentNotices.map((n) => n.applicationId)).toEqual(["due"]);
    expect(studentNotices[0].student.body).toContain("Ya pagué");
    expect(studentNotices[0].student.body).not.toMatch(/garantiz/i);
    expect(pay("due").student_reminder_sent_at).toBe(NOW.toISOString());
  });

  it("es idempotente y, con un menor, también avisa al familiar", async () => {
    boot([app("m", { payment_deadline_at: ahead(5), contact_target: "family_member" })], [payment("m")]);
    await remindResidencePayments(fake.client, NOW);
    expect(studentNotices[0].family).toMatchObject({ title: expect.stringContaining("Valentina R.") });
    studentNotices.length = 0;
    await remindResidencePayments(fake.client, new Date(NOW.getTime() + 3_600_000));
    expect(studentNotices).toEqual([]);
  });

  it("tras responder la residencia (marcas limpias y plazo nuevo) vuelve a haber recordatorio", async () => {
    boot([app("r", { payment_deadline_at: ahead(5) })], [payment("r", { student_reminder_sent_at: ago(40), student_payment_issue_at: ago(50), student_payment_issue_resolved_at: ago(2) })]);
    pay("r").student_reminder_sent_at = null; // lo que limpia resolveStudentPaymentIssue
    await remindResidencePayments(fake.client, NOW);
    expect(studentNotices.map((n) => n.applicationId)).toEqual(["r"]);
  });
});

describe("degradación", () => {
  it("sin la migración 0102 no rompe ni avisa", async () => {
    boot([app("a")], [payment("a", reported(80))], { missingColumns: { external_residence_payments: ["admin_alert_sent_at"] } });
    expect(await remindResidencePayments(fake.client, NOW)).toEqual({ residenceReminders: 0, adminAlerts: 0, studentReminders: 0, superadminEscalations: 0 });
  });
});

describe("escalado a los 7 días a todos los superadmin (DR66 (a))", () => {
  // A los 7 días la alerta de 72 h ya salió: el escalado se decide por `admin_escalated_at`, no por `admin_alert_sent_at`.
  const stale = { admin_alert_sent_at: ago(90), residence_reminder_sent_at: ago(140) };

  it("«Ya pagué» sin confirmar a los 7 días: avisa una sola vez, aunque la alerta de 72 h ya esté enviada, y no cambia el estado", async () => {
    boot([app("a")], [payment("a", reported(24 * 7 + 1, stale))]);
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 1, adminAlerts: 0 });
    expect(superNotices).toEqual([expect.objectContaining({ entityType: "application_requests", entityId: "a" })]);
    expect(pay("a")).toMatchObject({ status: "student_reported_paid", admin_escalated_at: NOW.toISOString() });
    expect(audits.some((a) => a.action === "residence_payment_escalated_to_superadmin" && a.actorRole === "system")).toBe(true);
    expect(fake.tables.application_requests[0].status).toBe("residence_payment_pending");
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 0 });
    expect(superNotices).toHaveLength(1);
  });

  it("«No pude realizar el pago» sin responder a los 7 días también escala; la solicitud no vence", async () => {
    boot([app("a")], [payment("a", { student_payment_issue_at: ago(24 * 8), ...stale })]);
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 1 });
    expect(fake.tables.application_requests[0].status).toBe("residence_payment_pending");
  });

  it("antes de 7 días, en disputa, ya confirmado, respondido o con la solicitud fuera de residence_payment_pending no escala", async () => {
    boot(
      [app("young"), app("disp"), app("done"), app("answered"), app("gone", { status: "expired" })],
      [
        payment("young", reported(24 * 6, stale)),
        payment("disp", { status: "disputed", student_reported_paid_at: ago(24 * 9), ...stale }),
        payment("done", { status: "reported_received_by_residence", student_reported_paid_at: ago(24 * 9), ...stale }),
        payment("answered", { student_payment_issue_at: ago(24 * 9), student_payment_issue_resolved_at: ago(2), ...stale }),
        payment("gone", reported(24 * 9, stale)),
      ],
    );
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 0 });
    expect(superNotices).toHaveLength(0);
  });

  it("sin superadmin a quién avisar devuelve la marca para reintentar", async () => {
    superControl.recipients = false;
    boot([app("a")], [payment("a", reported(24 * 7 + 1, stale))]);
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 0 });
    expect(pay("a").admin_escalated_at).toBeNull();
  });

  it("sin la migración 0110 no rompe ni escala", async () => {
    boot([app("a")], [payment("a", reported(24 * 8, stale))], { missingColumns: { external_residence_payments: ["admin_escalated_at"] } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await remindResidencePayments(fake.client, NOW)).toMatchObject({ superadminEscalations: 0 });
  });
});
