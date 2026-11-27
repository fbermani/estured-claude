import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/applications/roomTypeQueue", () => ({ promoteNextQueuedApplication: async () => undefined }));
vi.mock("@/lib/applications/reactivatePausedApplications", () => ({ reactivatePausedApplications: async () => undefined }));
vi.mock("@/lib/family/familyMilestones", () => ({ notifyFamilyApplicationMilestone: async () => undefined }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { expireApplicationRequests, selectExpirablePaymentPending } from "@/lib/jobs/expireApplicationRequests";

/**
 * DR63 (f) y (l): `residence_payment_pending` con plazo vencido NO vence si el estudiante avisó «Ya pagué» (por la fecha, aunque la
 * residencia lo haya disputado) o tiene abierto «No pude realizar el pago». Un aviso ya respondido no frena.
 */
const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

function app(id: string, over: Row = {}): Row {
  return { id, status: "residence_payment_pending", payment_deadline_at: PAST, room_type_id: null, student_profile_id: `sp-${id}`, ...over };
}
function payment(appId: string, over: Row = {}): Row {
  return {
    id: `pay-${appId}`,
    application_request_id: appId,
    status: "pending",
    student_reported_paid_at: null,
    student_payment_issue_at: null,
    student_payment_issue_resolved_at: null,
    ...over,
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const status = (id: string) => fake.tables.application_requests.find((a) => a.id === id)?.status;
const payStatus = (id: string) => fake.tables.external_residence_payments.find((p) => p.application_request_id === id)?.status;

beforeEach(() => {
  fake = createInMemorySupabase({
    application_requests: [
      app("plain"),
      app("reported", {}),
      app("disputed", {}),
      app("issue-open", {}),
      app("issue-resolved", {}),
      app("not-due", { payment_deadline_at: FUTURE }),
      app("legacy-no-payment-row"),
    ],
    external_residence_payments: [
      payment("plain"),
      payment("reported", { status: "student_reported_paid", student_reported_paid_at: PAST }),
      payment("disputed", { status: "disputed", student_reported_paid_at: PAST }),
      payment("issue-open", { student_payment_issue_at: PAST }),
      payment("issue-resolved", { student_payment_issue_at: PAST, student_payment_issue_resolved_at: PAST }),
      payment("not-due"),
    ],
    application_status_events: [],
  });
});

describe("expireApplicationRequests: avisos del estudiante frenan el vencimiento", () => {
  it("vencen las filas sin aviso (o con aviso ya respondido) y se sincroniza su pago", async () => {
    const result = await expireApplicationRequests(fake.client);
    expect(status("plain")).toBe("expired_no_student_payment");
    expect(status("issue-resolved")).toBe("expired_no_student_payment");
    expect(status("legacy-no-payment-row")).toBe("expired_no_student_payment");
    expect(payStatus("plain")).toBe("expired");
    expect(payStatus("issue-resolved")).toBe("expired");
    expect(result.expiredCount).toBe(3);
  });

  it("NO vencen «Ya pagué», «Ya pagué» disputado ni un aviso de problema abierto", async () => {
    await expireApplicationRequests(fake.client);
    for (const id of ["reported", "disputed", "issue-open"]) expect(status(id)).toBe("residence_payment_pending");
    expect(payStatus("reported")).toBe("student_reported_paid");
    expect(payStatus("disputed")).toBe("disputed");
    expect(payStatus("issue-open")).toBe("pending");
  });

  it("lo que todavía no venció sigue igual", async () => {
    await expireApplicationRequests(fake.client);
    expect(status("not-due")).toBe("residence_payment_pending");
  });

  it("es idempotente: correrlo de nuevo no cambia nada", async () => {
    await expireApplicationRequests(fake.client);
    const second = await expireApplicationRequests(fake.client);
    expect(second.expiredCount).toBe(0);
  });

  it("si no se pueden leer los avisos no se vence nada esa hora", async () => {
    const broken = createInMemorySupabase(
      { application_requests: [app("plain")], external_residence_payments: [payment("plain")], application_status_events: [] },
      { missingTables: ["external_residence_payments"] },
    );
    expect(await selectExpirablePaymentPending(broken.client, new Date().toISOString())).toBeNull();
    await expireApplicationRequests(broken.client);
    expect(broken.tables.application_requests[0].status).toBe("residence_payment_pending");
  });

  it("DR73 (a): un caso de Soporte de pago abierto frena el vencimiento; uno cerrado no", async () => {
    const withCases = createInMemorySupabase({
      application_requests: [app("open-case"), app("closed-case")],
      external_residence_payments: [payment("open-case"), payment("closed-case")],
      support_cases: [
        { id: "sc-1", topic: "residence_payment", related_entity_type: "application_requests", related_entity_id: "open-case", status: "under_review" },
        { id: "sc-2", topic: "residence_payment", related_entity_type: "application_requests", related_entity_id: "closed-case", status: "closed_no_action" },
      ],
      application_status_events: [],
    });
    await expireApplicationRequests(withCases.client);
    const st = (id: string) => withCases.tables.application_requests.find((a) => a.id === id)?.status;
    expect(st("open-case")).toBe("residence_payment_pending");
    expect(st("closed-case")).toBe("expired_no_student_payment");
  });

  it("sin la migración 0102 (columnas inexistentes) vence como antes de DR63", async () => {
    const legacy = createInMemorySupabase(
      { application_requests: [app("plain")], external_residence_payments: [payment("plain")], application_status_events: [] },
      { missingColumns: { external_residence_payments: ["student_reported_paid_at"] } },
    );
    await expireApplicationRequests(legacy.client);
    expect(legacy.tables.application_requests[0].status).toBe("expired_no_student_payment");
  });
});
