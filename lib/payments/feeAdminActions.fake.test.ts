import { beforeEach, describe, expect, it, vi } from "vitest";

type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; reasonText?: string; oldValue?: unknown; newValue?: unknown };
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
const discarded = vi.hoisted(() => [] as { fileId: string; storagePath: string }[]);
vi.mock("@/lib/applications/studentPaymentProof", () => ({
  PROOF_BUCKET: "payment-proofs",
  discardStoredProof: async (_a: unknown, f: { fileId: string; storagePath: string }) => void discarded.push(f),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { disputeFeePaymentCore, resolveFeePaymentIssueCore } from "@/lib/payments/feeAdminActions";
import { reopenEsturedFeeWindow } from "@/lib/reservations/reopenEsturedFeeWindow";

/** DR64 (d) y (e): «No recibí el pago», respuesta a «No pude realizar el pago» y reapertura tras la disputa. Cliente en memoria. */
const NOW = new Date("2026-11-21T12:00:00.000Z");
const ADMIN = { actorUserId: "u-admin", actorRole: "admin" as const };
const SECRET_DETAILS = "CBU 0000003100012345678901 alias estured.cobro";

function world(feeOver: Row = {}, extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    reservations: [{ id: "resv-1", status: "pending_estured_fee", estured_fee_payment_id: "fee-1" }],
    estured_fee_payments: [
      {
        id: "fee-1",
        status: "pending_manual_payment",
        reservation_id: "resv-1",
        renewal_offer_id: null,
        payer_user_id: "u-payer",
        expires_at: "2026-11-19T00:00:00Z",
        manual_payment_file_id: "file-1",
        student_reported_paid_at: "2026-11-20T00:00:00Z",
        admin_disputed_at: null,
        admin_dispute_reason: null,
        admin_disputed_by_user_id: null,
        student_payment_issue_at: null,
        student_payment_issue_resolved_at: null,
        chosen_method: "transfer_ars",
        payment_currency: "USD",
        instructions_snapshot: `Transferencia en pesos\n${SECRET_DETAILS}`,
        payer_reminder_sent_at: "2026-11-20T01:00:00Z",
        admin_reminder_sent_at: "2026-11-20T02:00:00Z",
        admin_alert_sent_at: null,
        ...feeOver,
      },
    ],
    support_cases: [],
    files: [{ id: "file-1", bucket: "payment-proofs", storage_path: "app-1/fee-proof-1.pdf", related_entity_type: "estured_fee_payments", related_entity_id: "fee-1" }],
    ...extra,
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const fee = () => fake.tables.estured_fee_payments[0];
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};
const dispute = (over: Record<string, unknown> = {}) =>
  disputeFeePaymentCore(fake.client, { ...ADMIN, feePaymentId: "fee-1", reason: "No figura el movimiento en la cuenta", seenReceiptFileId: "file-1", now: NOW, ...over });

beforeEach(() => {
  audits.length = 0;
  notices.length = 0;
  discarded.length = 0;
  boot();
});

describe("disputeFeePaymentCore («No recibí el pago»)", () => {
  it("marca la disputa sin cambiar el estado del fee ni de la reserva, abre el caso y avisa al pagador", async () => {
    expect(await dispute()).toEqual({ ok: true });
    expect(fee()).toMatchObject({
      status: "pending_manual_payment",
      admin_disputed_at: NOW.toISOString(),
      admin_dispute_reason: "No figura el movimiento en la cuenta",
      admin_disputed_by_user_id: "u-admin",
    });
    expect(fake.tables.reservations[0].status).toBe("pending_estured_fee");
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(fake.tables.support_cases[0]).toMatchObject({
      topic: "estured_fee_payment",
      opened_by_user_id: "u-payer",
      related_entity_type: "reservations",
      related_entity_id: "resv-1",
      residence_id: null,
    });
    expect(audits.map((a) => a.action)).toEqual(["support_case_opened", "estured_fee_payment_disputed"]);
    expect(audits[1]).toMatchObject({ actorUserId: "u-admin", reasonText: "No figura el movimiento en la cuenta" });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: "u-payer", relatedEntityType: "reservations" });
  });

  it("el aviso al pagador, el caso y la auditoría no llevan el motivo ni datos de cobro", async () => {
    await dispute({ reason: "MOTIVO-INTERNO-123 del admin" });
    const visible = JSON.stringify([notices, fake.tables.support_cases, audits.map((a) => ({ ...a, reasonText: undefined }))]);
    expect(visible).not.toContain("MOTIVO-INTERNO-123");
    expect(visible).not.toContain("0000003100012345678901");
  });

  it("valida el motivo (10 a 500) antes de leer nada", async () => {
    expect(await dispute({ reason: "corto" })).toMatchObject({ ok: false });
    expect(await dispute({ reason: "x".repeat(501) })).toMatchObject({ ok: false });
    expect(fake.log).toHaveLength(0);
  });

  it("idempotente: un segundo «No recibí el pago» no pisa ni duplica el caso", async () => {
    await dispute();
    const again = await dispute({ reason: "Otro motivo distinto de diez" });
    expect(again).toMatchObject({ ok: false });
    expect(fee().admin_dispute_reason).toBe("No figura el movimiento en la cuenta");
    expect(fake.tables.support_cases).toHaveLength(1);
  });

  it("si ya había un caso abierto de esa reserva, lo reusa en vez de abrir otro", async () => {
    boot(world({}, { support_cases: [{ id: "case-0", topic: "estured_fee_payment", related_entity_id: "resv-1", status: "under_review" }] }));
    expect(await dispute()).toEqual({ ok: true });
    expect(fake.tables.support_cases).toHaveLength(1);
  });

  it("un 23505 del insert se trata como éxito y devuelve el caso existente", async () => {
    // Carrera: el caso aparece entre la búsqueda y el insert.
    boot(world());
    const original = fake.client.from.bind(fake.client);
    let selects = 0;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = original(table) as unknown as Record<string, unknown>;
      if (table === "support_cases") {
        q.insert = () => {
          fake.tables.support_cases.push({ id: "case-race", topic: "estured_fee_payment", related_entity_id: "resv-1", status: "opened" });
          selects += 1;
          return { select: () => ({ single: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }) }) };
        };
      }
      return q;
    };
    expect(await dispute()).toEqual({ ok: true });
    expect(selects).toBe(1);
  });

  it("rechaza si el pago no está informado, no tiene comprobante, cambió el comprobante o es una renovación", async () => {
    boot(world({ status: "pending_payment_method" }));
    expect(await dispute()).toMatchObject({ ok: false });
    boot(world({ manual_payment_file_id: null }));
    expect(await dispute()).toMatchObject({ ok: false });
    boot();
    expect(await dispute({ seenReceiptFileId: "file-viejo" })).toMatchObject({ ok: false });
    boot(world({ reservation_id: null, renewal_offer_id: "ro-1" }));
    expect(await dispute()).toMatchObject({ ok: false });
    expect(fake.log.filter((l) => l.op !== "select")).toHaveLength(0);
  });

  it("rechaza si la reserva ya no espera el fee", async () => {
    boot(world({}, { reservations: [{ id: "resv-1", status: "confirmed", estured_fee_payment_id: "fee-1" }] }));
    expect(await dispute()).toMatchObject({ ok: false });
    expect(fee().admin_disputed_at).toBeNull();
  });

  it("si el caso de Soporte no se puede abrir, deshace la disputa", async () => {
    boot(world());
    const fakeWithFailingCase = createInMemorySupabase(world(), { failInsert: { support_cases: { code: "XX000", message: "boom" } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await disputeFeePaymentCore(fakeWithFailingCase.client, { ...ADMIN, feePaymentId: "fee-1", reason: "No figura el movimiento en la cuenta", seenReceiptFileId: "file-1", now: NOW });
    expect(res).toMatchObject({ ok: false });
    expect(fakeWithFailingCase.tables.estured_fee_payments[0]).toMatchObject({ admin_disputed_at: null, admin_dispute_reason: null, admin_disputed_by_user_id: null });
    expect(audits.filter((a) => a.action === "estured_fee_payment_disputed")).toHaveLength(0);
  });
});

describe("resolveFeePaymentIssueCore (responde «No pude realizar el pago»)", () => {
  const issueFee = { status: "pending_payment_method", manual_payment_file_id: null, student_reported_paid_at: null, student_payment_issue_at: "2026-11-20T10:00:00Z" };
  const resolve = (resolution: unknown = "reopen_payment", over: Record<string, unknown> = {}) =>
    resolveFeePaymentIssueCore(fake.client, { ...ADMIN, feePaymentId: "fee-1", resolution, reason: "El medio no le funcionó", now: NOW, ...over });
  beforeEach(() => boot(world(issueFee)));

  it("«Reabrir el pago»: cierra el aviso, reinicia 48 h, limpia las marcas y avisa al pagador", async () => {
    expect(await resolve("reopen_payment")).toEqual({ ok: true });
    expect(fee()).toMatchObject({
      status: "pending_payment_method",
      student_payment_issue_resolved_at: NOW.toISOString(),
      expires_at: new Date(NOW.getTime() + 48 * 3_600_000).toISOString(),
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
      chosen_method: "transfer_ars",
    });
    expect(fake.tables.support_cases).toHaveLength(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "estured_fee_payment_issue_resolved", reasonText: "El medio no le funcionó" });
    expect(notices).toHaveLength(1);
    expect(JSON.stringify(notices)).not.toContain("El medio no le funcionó");
  });

  it("«Contactar al pagador»: además abre un caso de Soporte a nombre del pagador", async () => {
    expect(await resolve("contact_payer")).toEqual({ ok: true });
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(fake.tables.support_cases[0]).toMatchObject({ topic: "estured_fee_payment", opened_by_user_id: "u-payer", related_entity_id: "resv-1" });
    expect(fee().student_payment_issue_resolved_at).toBe(NOW.toISOString());
  });

  it("valida opción y motivo; sin aviso abierto o ya respondido, rechaza", async () => {
    expect(await resolve("otra")).toMatchObject({ ok: false });
    expect(await resolve("reopen_payment", { reason: "no" })).toMatchObject({ ok: false });
    await resolve("reopen_payment");
    expect(await resolve("reopen_payment")).toMatchObject({ ok: false });
    boot(world({ ...issueFee, student_payment_issue_at: null }));
    expect(await resolve("reopen_payment")).toMatchObject({ ok: false });
  });

  it("en una renovación solo se puede reabrir el pago", async () => {
    boot(world({ ...issueFee, reservation_id: null, renewal_offer_id: "ro-1" }));
    expect(await resolve("contact_payer")).toMatchObject({ ok: false });
    expect(await resolve("reopen_payment")).toEqual({ ok: true });
    expect(notices[0]).toMatchObject({ relatedEntityType: "renewal_offers", relatedEntityId: "ro-1" });
  });

  it("si el caso de Soporte falla, devuelve el aviso a abierto con su plazo", async () => {
    const f = createInMemorySupabase(world(issueFee), { failInsert: { support_cases: { code: "XX000", message: "boom" } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await resolveFeePaymentIssueCore(f.client, { ...ADMIN, feePaymentId: "fee-1", resolution: "contact_payer", reason: "Lo llamamos por Soporte", now: NOW });
    expect(res).toMatchObject({ ok: false });
    expect(f.tables.estured_fee_payments[0]).toMatchObject({ student_payment_issue_resolved_at: null, expires_at: "2026-11-19T00:00:00Z" });
  });
});

describe("reopenEsturedFeeWindow tras «No recibí el pago»", () => {
  const disputed = { admin_disputed_at: "2026-11-21T09:00:00Z", admin_dispute_reason: "No figura el movimiento", admin_disputed_by_user_id: "u-admin" };
  const reopen = (over: Record<string, unknown> = {}) =>
    reopenEsturedFeeWindow(fake.client, { feePaymentId: "fee-1", actorUserId: "u-admin", actorRole: "admin", reason: "Soporte pidió otro comprobante", ...over });
  beforeEach(() => boot(world(disputed)));

  it("vuelve a pending_payment_method con 48 h, limpia reporte, comprobante y disputa, conserva el comprobante como evidencia y pide elegir el medio de nuevo", async () => {
    const before = Date.now();
    expect(await reopen()).toEqual({ status: "ok" });
    expect(fee()).toMatchObject({
      status: "pending_payment_method",
      student_reported_paid_at: null,
      manual_payment_file_id: null,
      admin_disputed_at: null,
      admin_dispute_reason: null,
      admin_disputed_by_user_id: null,
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
      chosen_method: null,
      instructions_snapshot: null,
      payment_currency: "ARS",
    });
    expect(new Date(fee().expires_at as string).getTime()).toBeGreaterThanOrEqual(before + 48 * 3_600_000 - 1000);
    expect(fake.tables.reservations[0].status).toBe("pending_estured_fee");
    // El comprobante en disputa NO se borra: queda archivado en `files` y su id va a la auditoría (evidencia del caso de Soporte).
    expect(discarded).toHaveLength(0);
    expect(fake.tables.files).toHaveLength(1);
    expect(fake.tables.files[0]).toMatchObject({ id: "file-1", status: "archived", storage_path: "app-1/fee-proof-1.pdf" });
    expect(audits[0]).toMatchObject({ action: "estured_fee_payment_reopened_after_dispute", reasonText: "Soporte pidió otro comprobante" });
    expect(audits[0].oldValue).toMatchObject({ disputed_proof_file_id: "file-1" });
    expect(notices.some((n) => n.userId === "u-payer")).toBe(true);
    expect(JSON.stringify(notices)).not.toContain("Soporte pidió otro comprobante");
  });

  it("no toca un archivo que no es de ese fee", async () => {
    boot(world(disputed, { files: [{ id: "file-1", bucket: "payment-proofs", storage_path: "x.pdf", related_entity_type: "application_requests", related_entity_id: "otro", status: "uploaded" }] }));
    expect(await reopen()).toEqual({ status: "ok" });
    expect(discarded).toHaveLength(0);
    expect(fake.tables.files[0]).toMatchObject({ status: "uploaded" });
    expect(audits[0].oldValue).toMatchObject({ disputed_proof_file_id: null });
  });

  it("sin disputa ni vencimiento no se puede reabrir; tampoco con la reserva ya confirmada", async () => {
    boot(world());
    expect(await reopen()).toMatchObject({ status: "error" });
    boot(world(disputed, { reservations: [{ id: "resv-1", status: "confirmed", estured_fee_payment_id: "fee-1" }] }));
    expect(await reopen()).toMatchObject({ status: "error" });
    expect(fee().status).toBe("pending_manual_payment");
  });
});
