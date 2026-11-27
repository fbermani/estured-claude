import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/family/notifyLinkedFamily", () => ({ loadStudentShortName: async () => "Lucía F." }));
const notices = vi.hoisted(() => [] as { kind: string; body: string }[]);
vi.mock("@/lib/applications/paymentDeadlineNotices", () => ({
  deliverStudentSideNotice: async (_a: unknown, p: { build: (a: string) => { body: string } }) => (notices.push({ kind: "student", body: p.build("student").body }), true),
  deliverResidenceNotice: async (_a: unknown, p: { copy: { body: string } }) => (notices.push({ kind: "residence", body: p.copy.body }), true),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { announceNewPaymentWindow, prepareNewPaymentWindow, rollbackNewPaymentWindow } from "@/lib/applications/paymentCaseNewWindow";

/** DR73 (c): plazo nuevo de 24 h al cerrar el caso de Soporte de pago con el plazo vencido. */
const NOW = new Date("2026-11-27T12:00:00.000Z");
const PAST = "2026-11-27T10:00:00.000Z";
const NEW = "2026-11-28T12:00:00.000Z";

function world(app: Row = {}, payment: Row = {}) {
  return createInMemorySupabase({
    application_requests: [
      { id: "app-1", status: "residence_payment_pending", residence_id: "res-1", student_profile_id: "sp-1", contact_target: "student", payment_deadline_at: PAST, ...app },
    ],
    external_residence_payments: [
      { id: "pay-1", application_request_id: "app-1", status: "pending", student_reported_paid_at: null, student_payment_issue_at: null, student_payment_issue_resolved_at: null, deadline_alert_stage: 4, deadline_alert_for: PAST, ...payment },
    ],
    residences: [{ id: "res-1", name: "Norte" }],
  });
}

describe("prepareNewPaymentWindow", () => {
  it("con el plazo vencido y nada que lo frene: 24 h más y alertas desde la etapa de 12 h", async () => {
    const fake = world();
    const prepared = await prepareNewPaymentWindow(fake.client, "app-1", NOW);
    expect(prepared).toMatchObject({ kind: "applied", previousDeadline: PAST, deadline: NEW });
    expect(fake.tables.application_requests[0].payment_deadline_at).toBe(NEW);
    expect(fake.tables.external_residence_payments[0]).toMatchObject({ deadline_alert_stage: 2, deadline_alert_for: NEW });

    notices.length = 0;
    await announceNewPaymentWindow(fake.client, prepared, { actorUserId: "admin", actorRole: "admin", supportCaseId: "sc-1" });
    expect(notices.map((n) => n.kind)).toEqual(["student", "residence"]);
    expect(notices[0].body).toMatch(/^Se cerró el caso de Soporte\. Pagá en Norte/);
  });

  it("si el plazo no venció, hay «Ya pagué» o la solicitud ya no espera el pago, no hace nada", async () => {
    for (const fake of [
      world({ payment_deadline_at: "2026-11-27T20:00:00.000Z" }),
      world({}, { status: "student_reported_paid", student_reported_paid_at: PAST }),
      world({}, { student_payment_issue_at: PAST }),
      world({ status: "residence_payment_reported" }),
    ]) {
      expect(await prepareNewPaymentWindow(fake.client, "app-1", NOW)).toEqual({ kind: "none" });
    }
  });

  it("si el cierre del caso falla, vuelve el plazo anterior", async () => {
    const fake = world();
    const prepared = await prepareNewPaymentWindow(fake.client, "app-1", NOW);
    await rollbackNewPaymentWindow(fake.client, prepared);
    expect(fake.tables.application_requests[0].payment_deadline_at).toBe(PAST);
  });

  it("si no se puede leer, devuelve error (el admin reintenta el cierre)", async () => {
    const fake = createInMemorySupabase({ application_requests: [] }, { missingTables: ["application_requests"] });
    expect(await prepareNewPaymentWindow(fake.client, "app-1", NOW)).toEqual({ kind: "error" });
  });
});
