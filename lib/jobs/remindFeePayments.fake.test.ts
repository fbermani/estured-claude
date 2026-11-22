import { beforeEach, describe, expect, it, vi } from "vitest";

type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
const notices = vi.hoisted(() => [] as { userId: string; title: string; body: string; relatedEntityType?: string; relatedEntityId?: string }[]);
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: async (_a: unknown, n: { userId: string; title: string; body: string }) => void notices.push(n),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { remindFeePayments } from "@/lib/jobs/remindFeePayments";

/** DR64 (f): recordatorio de 12 h al pagador, aviso de 24 h y alerta de 72 h a los admin. Cliente en memoria. */
const NOW = new Date("2026-11-21T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const baseFee: Row = {
  id: "fee-1",
  status: "pending_payment_method",
  reservation_id: "resv-1",
  renewal_offer_id: null,
  payer_user_id: "u-payer",
  expires_at: inHours(40),
  student_reported_paid_at: null,
  student_payment_issue_at: null,
  student_payment_issue_resolved_at: null,
  admin_disputed_at: null,
  payer_reminder_sent_at: null,
  admin_reminder_sent_at: null,
  admin_alert_sent_at: null,
};

function world(feeOver: Row = {}, extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    estured_fee_payments: [{ ...baseFee, ...feeOver }],
    user_roles: [
      { user_id: "u-admin1", role: "admin" },
      { user_id: "u-super", role: "superadmin" },
      { user_id: "u-student", role: "student" },
    ],
    estured_fee_collection_methods: [
      { id: "m1", method_key: "transfer_ars", method_label: null, details: "CBU de demo", currency: "ARS", is_enabled: true, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" },
    ],
    payment_settings: [],
    support_cases: [],
    ...extra,
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const fee = () => fake.tables.estured_fee_payments[0];
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};
const run = () => remindFeePayments(fake.client, NOW);
const reported = (hours: number, over: Row = {}) => ({ status: "pending_manual_payment", student_reported_paid_at: hoursAgo(hours), expires_at: hoursAgo(5), ...over });
const issue = (hours: number, over: Row = {}) => ({ student_payment_issue_at: hoursAgo(hours), ...over });

beforeEach(() => {
  audits.length = 0;
  notices.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  boot();
});

describe("recordatorio de 12 h al pagador", () => {
  it("avisa al pagador cuando faltan menos de 12 h, una sola vez", async () => {
    boot(world({ expires_at: inHours(10) }));
    expect(await run()).toMatchObject({ payerReminders: 1 });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: "u-payer", relatedEntityType: "reservations", relatedEntityId: "resv-1" });
    expect(fee().payer_reminder_sent_at).toBe(NOW.toISOString());
    expect(await run()).toMatchObject({ payerReminders: 0 });
    expect(notices).toHaveLength(1);
  });

  it("no avisa si falta más de 12 h, si ya venció, si ya informó el pago o si hay un aviso abierto", async () => {
    for (const over of [{ expires_at: inHours(30) }, { expires_at: hoursAgo(1) }, { expires_at: inHours(5), student_reported_paid_at: hoursAgo(1) }, { expires_at: inHours(5), ...issue(2) }]) {
      boot(world(over));
      expect(await run()).toMatchObject({ payerReminders: 0 });
    }
    expect(notices.filter((n) => n.userId === "u-payer")).toHaveLength(0);
  });

  it("sin medios para ofrecer (ni respaldo) no recuerda pagar", async () => {
    boot(world({ expires_at: inHours(10) }, { estured_fee_collection_methods: [] }));
    expect(await run()).toMatchObject({ payerReminders: 0 });
    expect(fee().payer_reminder_sent_at).toBeNull();
  });

  it("el texto no lleva montos ni datos de cobro", async () => {
    boot(world({ expires_at: inHours(10) }));
    await run();
    expect(JSON.stringify(notices)).not.toMatch(/CBU|\$|ARS|USD/);
  });
});

describe("aviso de 24 h y alerta de 72 h a los admin", () => {
  it("«Ya pagué» sin validar: a las 24 h avisa a los admin (no al estudiante); antes, no", async () => {
    boot(world(reported(23)));
    expect(await run()).toMatchObject({ adminReminders: 0 });
    boot(world(reported(25)));
    expect(await run()).toMatchObject({ adminReminders: 1, adminAlerts: 0 });
    expect(notices.map((n) => n.userId).sort()).toEqual(["u-admin1", "u-super"]);
    expect(fee().admin_reminder_sent_at).toBe(NOW.toISOString());
    expect(await run()).toMatchObject({ adminReminders: 0 });
    expect(notices).toHaveLength(2);
  });

  it("a las 72 h manda la alerta y abre un caso de Soporte único por reserva, sin tocar el estado", async () => {
    boot(world(reported(73)));
    expect(await run()).toMatchObject({ adminReminders: 1, adminAlerts: 1 });
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(fake.tables.support_cases[0]).toMatchObject({ topic: "estured_fee_payment", opened_by_user_id: "u-payer", opened_by_role: "system", related_entity_id: "resv-1" });
    expect(fee()).toMatchObject({ status: "pending_manual_payment", admin_alert_sent_at: NOW.toISOString() });
    expect(audits.some((a) => a.action === "estured_fee_unanswered_alert" && a.actorUserId === null)).toBe(true);
    await run();
    expect(fake.tables.support_cases).toHaveLength(1);
  });

  it("«No pude realizar el pago» sin responder sigue los mismos plazos", async () => {
    boot(world(issue(30)));
    expect(await run()).toMatchObject({ adminReminders: 1 });
    boot(world(issue(80)));
    expect(await run()).toMatchObject({ adminAlerts: 1 });
    expect(fake.tables.support_cases).toHaveLength(1);
  });

  it("con «No recibí el pago» o con el aviso ya respondido no se manda nada", async () => {
    boot(world(reported(80, { admin_disputed_at: hoursAgo(10) })));
    expect(await run()).toMatchObject({ adminReminders: 0, adminAlerts: 0 });
    boot(world(issue(80, { student_payment_issue_resolved_at: hoursAgo(1) })));
    expect(await run()).toMatchObject({ adminReminders: 0, adminAlerts: 0 });
    expect(notices).toHaveLength(0);
  });

  it("una fila anterior a 0105 (pending_manual_payment sin student_reported_paid_at) no recibe avisos", async () => {
    boot(world({ status: "pending_manual_payment", expires_at: hoursAgo(100) }));
    expect(await run()).toMatchObject({ adminReminders: 0, adminAlerts: 0 });
  });

  it("si no hay a quién avisar devuelve la marca para reintentar", async () => {
    boot(world(reported(25), { user_roles: [] }));
    expect(await run()).toMatchObject({ adminReminders: 0 });
    expect(fee().admin_reminder_sent_at).toBeNull();
  });

  it("si el caso de Soporte no se puede abrir, devuelve la marca de la alerta y no avisa", async () => {
    const f = createInMemorySupabase(world(reported(80), {}), { failInsert: { support_cases: { code: "XX000", message: "boom" } } });
    const res = await remindFeePayments(f.client, NOW);
    expect(res.adminAlerts).toBe(0);
    expect(f.tables.estured_fee_payments[0].admin_alert_sent_at).toBeNull();
  });

  it("una renovación recibe la alerta sin caso de Soporte (no hay reserva a la que atarlo)", async () => {
    boot(world(reported(80, { reservation_id: null, renewal_offer_id: "ro-1" })));
    expect(await run()).toMatchObject({ adminAlerts: 1 });
    expect(fake.tables.support_cases).toHaveLength(0);
    expect(notices.every((n) => n.relatedEntityType === "estured_fee_payments" && n.relatedEntityId === "fee-1")).toBe(true);
  });
});
