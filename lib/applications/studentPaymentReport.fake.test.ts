import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
const family = vi.hoisted(() => ({ value: null as null | { userId: string; name: string; permissions: Record<string, unknown> } }));
vi.mock("@/lib/family/access", () => ({ loadActiveFamilyOfStudent: async () => family.value }));
const notices = vi.hoisted(() => ({ residence: [] as { kind: string; isMinor: boolean }[], counterpart: [] as { actorRole: string; kind: string }[] }));
vi.mock("@/lib/applications/paymentReportNotices", () => ({
  notifyResidencePaymentTeam: async (_a: unknown, p: { kind: string; isMinor: boolean }) => void notices.residence.push(p),
  notifyPaymentCounterpart: async (_a: unknown, p: { actorRole: string; kind: string }) => void notices.counterpart.push(p),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { reportResidencePaymentIssueCore, reportResidencePaymentPaidCore } from "@/lib/applications/studentPaymentReport";

/** DR63 (e) y (l): «Ya pagué» y «No pude realizar el pago». Cliente en memoria; el actor sale de la base. */
const NOW_MARKS = { residence_reminder_sent_at: "2026-11-20T00:00:00Z", student_reminder_sent_at: "2026-11-20T00:00:00Z", admin_alert_sent_at: "2026-11-20T00:00:00Z" };

function world(over: { app?: Row; payment?: Row } = {}): Record<string, Row[]> {
  return {
    application_requests: [
      { id: "app-1", status: "residence_payment_pending", residence_id: "res-1", student_profile_id: "sp-1", contact_target: "student", collection_mode: "enabled_methods", payment_deadline_at: "2030-01-01T00:00:00Z", ...over.app },
    ],
    student_profiles: [{ id: "sp-1", user_id: "u-student" }],
    external_residence_payments: [
      {
        id: "pay-1",
        application_request_id: "app-1",
        status: "pending",
        student_reported_paid_at: null,
        student_payment_issue_at: null,
        student_payment_issue_reason: null,
        student_payment_issue_resolved_at: null,
        student_proof_file_id: null,
        ...NOW_MARKS,
        ...over.payment,
      },
    ],
    files: [],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const pay = () => fake.tables.external_residence_payments[0];
const writes = () => fake.log.filter((l) => l.op !== "select");
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};
/** Cliente con un Storage mínimo (el fake no lo trae). */
function withStorage() {
  const uploaded: string[] = [];
  const removed: string[] = [];
  const client = Object.assign(fake.client, {
    storage: { from: () => ({ upload: async (path: string) => (uploaded.push(path), { error: null }), remove: async (paths: string[]) => (removed.push(...paths), { error: null }) }) },
  });
  return { client, uploaded, removed };
}
const pdf = (name = "comprobante.pdf") => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], name, { type: "application/pdf" });

beforeEach(() => {
  audits.length = 0;
  notices.residence.length = 0;
  notices.counterpart.length = 0;
  family.value = { userId: "u-family", name: "Martín", permissions: { can_pay_estured_fee: true } };
  boot();
});

describe("«Ya pagué»", () => {
  it("marca student_reported_paid, limpia las tres marcas, audita sin datos de cobro y avisa a la residencia", async () => {
    const res = await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(pay()).toMatchObject({ status: "student_reported_paid", residence_reminder_sent_at: null, student_reminder_sent_at: null, admin_alert_sent_at: null });
    expect(pay().student_reported_paid_at).toBeTruthy();
    expect(fake.tables.application_requests[0].status).toBe("residence_payment_pending"); // la solicitud no cambia de estado
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "residence_payment_reported_paid", actorRole: "student", newValue: { with_proof: false, reported_by: "student" } });
    expect(notices.residence).toHaveLength(1);
    expect(notices.residence[0]).toMatchObject({ kind: "student_reported_paid", isMinor: false });
    expect(notices.counterpart).toEqual([]);
  });

  it("es idempotente: el segundo toque no escribe, ni audita ni avisa", async () => {
    await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
    const before = writes().length;
    audits.length = 0;
    notices.residence.length = 0;
    expect(await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" })).toEqual({ ok: true, alreadyReported: true });
    expect(writes()).toHaveLength(before);
    expect(audits).toEqual([]);
    expect(notices.residence).toEqual([]);
  });

  it("solo el estudiante o el familiar pagador de un menor; el resto recibe «No encontramos esa solicitud» y no se escribe nada", async () => {
    for (const actor of ["u-otro", "u-family", "ricardo-owner"]) {
      boot();
      expect(await reportResidencePaymentPaidCore(fake.client, { actorUserId: actor, applicationId: "app-1" })).toEqual({ ok: false, error: "No encontramos esa solicitud." });
      expect(writes()).toEqual([]);
    }
  });

  it("el familiar pagador de un menor puede, y se avisa al estudiante", async () => {
    boot(world({ app: { contact_target: "family_member" } }));
    expect(await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-family", applicationId: "app-1" })).toEqual({ ok: true, alreadyReported: false });
    expect(audits[0]).toMatchObject({ actorRole: "family_member", newValue: { reported_by: "family_payer" } });
    expect(notices.residence[0]).toMatchObject({ isMinor: true });
    expect(notices.counterpart).toHaveLength(1);
    expect(notices.counterpart[0]).toMatchObject({ actorRole: "family_payer", kind: "paid" });
  });

  it("estados que no admiten el aviso", async () => {
    const cases: [Row, Row, RegExp][] = [
      [{ status: "converted_to_reservation" }, {}, /ya no está esperando/],
      [{ collection_mode: null }, {}, /lo coordina la residencia/],
      [{}, { status: "reported_received_by_residence" }, /ya no admite cambios/],
      [{}, { status: "expired" }, /ya no admite cambios/],
      [{}, { status: "disputed" }, /ya no admite cambios/],
      [{}, { student_payment_issue_at: "2026-11-20T10:00:00Z" }, /Ya avisaste que no pudiste/],
    ];
    for (const [app, payment, re] of cases) {
      boot(world({ app, payment }));
      const res = await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(re);
      expect(writes()).toEqual([]);
    }
  });

  it("contacto directo también admite «Ya pagué» (DR74 (c))", async () => {
    boot(world({ app: { collection_mode: "whatsapp_direct" } }));
    const res = await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
    expect(res).toEqual({ ok: true, alreadyReported: false });
  });

  it("el comprobante es opcional y, si viene, se guarda y se vincula", async () => {
    const { client, uploaded } = withStorage();
    const res = await reportResidencePaymentPaidCore(client, { actorUserId: "u-student", applicationId: "app-1", proofInput: pdf() });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatch(/^app-1\/student-proof-/);
    expect(fake.tables.files).toHaveLength(1);
    expect(fake.tables.files[0]).toMatchObject({ bucket: "payment-proofs", document_type: "student_payment_proof_to_residence", related_entity_id: "app-1", owner_user_id: "u-student" });
    expect(pay().student_proof_file_id).toBe(fake.tables.files[0].id);
    expect(audits[0].newValue).toMatchObject({ with_proof: true });
  });

  it("un comprobante nuevo reemplaza al anterior y lo descarta (fila y objeto), sin dejar huérfanos", async () => {
    const old = { id: "file-old", bucket: "payment-proofs", storage_path: "app-1/student-proof-old.pdf", document_type: "student_payment_proof_to_residence" };
    boot(world({ payment: { status: "student_reference_uploaded", student_proof_file_id: "file-old" } }));
    fake.tables.files.push(old);
    const { client, removed } = withStorage();
    const res = await reportResidencePaymentPaidCore(client, { actorUserId: "u-student", applicationId: "app-1", proofInput: pdf() });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(fake.tables.files.map((f) => f.id)).not.toContain("file-old");
    expect(fake.tables.files).toHaveLength(1);
    expect(pay().student_proof_file_id).toBe(fake.tables.files[0].id);
    expect(removed).toEqual(["app-1/student-proof-old.pdf"]);
  });

  it("si la solicitud venció tras subir un comprobante, el rollback devuelve el anterior y descarta el nuevo", async () => {
    boot(world({ payment: { status: "student_reference_uploaded", student_proof_file_id: "file-old" } }));
    fake.tables.files.push({ id: "file-old", bucket: "payment-proofs", storage_path: "app-1/student-proof-old.pdf", document_type: "student_payment_proof_to_residence" });
    const real = fake.client.from.bind(fake.client);
    let flipped = false;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = real(table) as { update: (p: Row) => unknown };
      if (table === "external_residence_payments" && !flipped) {
        const originalUpdate = q.update.bind(q);
        q.update = (payload: Row) => {
          flipped = true;
          fake.tables.application_requests[0].status = "expired_no_student_payment";
          return originalUpdate(payload);
        };
      }
      return q;
    };
    const { client, removed } = withStorage();
    const res = await reportResidencePaymentPaidCore(client, { actorUserId: "u-student", applicationId: "app-1", proofInput: pdf() });
    expect(res.ok).toBe(false);
    expect(pay()).toMatchObject({ status: "student_reference_uploaded", student_reported_paid_at: null, student_proof_file_id: "file-old" });
    expect(fake.tables.files.map((f) => f.id)).toEqual(["file-old"]);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatch(/^app-1\/student-proof-(?!old)/);
  });

  it("un comprobante inválido se rechaza antes de escribir", async () => {
    const bad = new File([new Uint8Array([1, 2, 3])], "x.pdf", { type: "application/pdf" });
    const res = await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", proofInput: bad });
    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
    const exe = new File([new Uint8Array([0x4d, 0x5a])], "x.exe", { type: "application/x-msdownload" });
    expect((await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", proofInput: exe })).ok).toBe(false);
  });

  it("si la solicitud venció entre la lectura y el update, se deshace el aviso", async () => {
    // El job de vencimiento corre justo después de la primera lectura: se simula cambiando el estado cuando se toca el pago.
    const real = fake.client.from.bind(fake.client);
    let flipped = false;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = real(table) as { update: (p: Row) => unknown };
      if (table === "external_residence_payments" && !flipped) {
        const originalUpdate = q.update.bind(q);
        q.update = (payload: Row) => {
          flipped = true;
          fake.tables.application_requests[0].status = "expired_no_student_payment";
          return originalUpdate(payload);
        };
      }
      return q;
    };
    const res = await reportResidencePaymentPaidCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
    expect(res.ok).toBe(false);
    expect(pay()).toMatchObject({ status: "pending", student_reported_paid_at: null });
    expect(audits).toEqual([]);
  });
});

describe("«No pude realizar el pago»", () => {
  it("setea el aviso con motivo, limpia las marcas, audita sin el texto y avisa a la residencia", async () => {
    const res = await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "  mi banco rechazó la transferencia  " });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(pay()).toMatchObject({
      status: "pending", // sin estado nuevo del enum
      student_payment_issue_reason: "mi banco rechazó la transferencia",
      student_payment_issue_resolved_at: null,
      residence_reminder_sent_at: null,
      student_reminder_sent_at: null,
      admin_alert_sent_at: null,
    });
    expect(pay().student_payment_issue_at).toBeTruthy();
    expect(audits[0]).toMatchObject({ action: "residence_payment_issue_reported", newValue: { has_reason: true } });
    expect(JSON.stringify(audits)).not.toContain("banco");
    expect(notices.residence[0]).toMatchObject({ kind: "student_payment_issue" });
  });

  it("el motivo es opcional; si se escribe, al menos 10 caracteres", async () => {
    expect((await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "corto" })).ok).toBe(false);
    expect(writes()).toEqual([]);
    expect(await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "" })).toEqual({ ok: true, alreadyReported: false });
    expect(pay().student_payment_issue_reason).toBeNull();
  });

  it("es idempotente con un aviso abierto", async () => {
    await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" });
    const before = writes().length;
    notices.residence.length = 0;
    expect(await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" })).toEqual({ ok: true, alreadyReported: true });
    expect(writes()).toHaveLength(before);
    expect(notices.residence).toEqual([]);
  });

  it("un aviso nuevo tras una respuesta reabre el aviso (una sola marca por pago)", async () => {
    boot(world({ payment: { student_payment_issue_at: "2026-11-19T10:00:00Z", student_payment_issue_resolved_at: "2026-11-19T12:00:00Z" } }));
    expect(await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "volvió a fallar el pago" })).toEqual({ ok: true, alreadyReported: false });
    expect(pay().student_payment_issue_resolved_at).toBeNull();
    expect(pay().student_payment_issue_at).not.toBe("2026-11-19T10:00:00Z");
  });

  it("no corresponde con «Ya pagué», contacto directo, otro estado o un actor ajeno", async () => {
    for (const [app, payment] of [
      [{}, { status: "student_reported_paid", student_reported_paid_at: "2026-11-20T10:00:00Z" }],
      [{ collection_mode: "whatsapp_direct" }, {}],
      [{ status: "expired_no_student_payment" }, {}],
    ] as [Row, Row][]) {
      boot(world({ app, payment }));
      expect((await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1" })).ok).toBe(false);
      expect(writes()).toEqual([]);
    }
    boot();
    expect(await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-otro", applicationId: "app-1" })).toEqual({ ok: false, error: "No encontramos esa solicitud." });
  });

  it("si la solicitud venció tras avisar el problema, el rollback solo deshace con el pago todavía en pending", async () => {
    const real = fake.client.from.bind(fake.client);
    let flipped = false;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = real(table) as { update: (p: Row) => unknown };
      if (table === "external_residence_payments" && !flipped) {
        const originalUpdate = q.update.bind(q);
        q.update = (payload: Row) => {
          flipped = true;
          const builder = originalUpdate(payload) as { then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => unknown };
          const originalThen = builder.then.bind(builder);
          // Recién DESPUÉS de que el reclamo se aplicó: vence la solicitud y otro proceso mueve el pago (p. ej. la residencia lo disputa).
          builder.then = (ok, ko) =>
            originalThen((value) => {
              fake.tables.application_requests[0].status = "expired_no_student_payment";
              fake.tables.external_residence_payments[0].status = "disputed";
              return ok(value);
            }, ko);
          return builder;
        };
      }
      return q;
    };
    const res = await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "no me dejó transferir" });
    expect(res.ok).toBe(false);
    expect(pay().status).toBe("disputed");
    expect(pay().student_payment_issue_reason).toBe("no me dejó transferir");
  });

  it("el familiar pagador de un menor puede y se avisa al estudiante", async () => {
    boot(world({ app: { contact_target: "family_member" } }));
    expect((await reportResidencePaymentIssueCore(fake.client, { actorUserId: "u-family", applicationId: "app-1" })).ok).toBe(true);
    expect(notices.counterpart[0]).toMatchObject({ actorRole: "family_payer", kind: "issue" });
  });
});
