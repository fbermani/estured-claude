import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; newValue?: unknown; reasonText?: string };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
const adminNotices = vi.hoisted(() => [] as { title: string }[]);
vi.mock("@/lib/notifications/notifyAdminsSafe", () => ({ notifyAdminsSafe: async (_a: unknown, p: { title: string }) => void adminNotices.push(p) }));
const studentNotices = vi.hoisted(() => [] as { student: { title: string; body: string }; family: unknown }[]);
vi.mock("@/lib/applications/paymentReportNotices", () => ({
  notifyStudentAndFamily: async (_a: unknown, p: { student: { title: string; body: string }; family: unknown }) => void studentNotices.push(p),
}));
const collectionNotices = vi.hoisted(() => [] as { mode: string; methodLabel: string | null; isMinor: boolean }[]);
vi.mock("@/lib/applications/notifyCollectionEnabled", () => ({
  notifyCollectionEnabled: async (_a: unknown, p: { mode: string; methodLabel: string | null; isMinor: boolean }) => void collectionNotices.push(p),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { OWNER_ONLY_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { RESIDENCE_REOPEN_CAP_MESSAGE } from "@/lib/payments/reopenCap";
import {
  disputeReportedResidencePaymentCore,
  openStudentPaymentProofCore,
  resolveStudentPaymentIssueCore,
} from "@/lib/applications/residencePaymentReview";

/**
 * DR63 (j) 1 y (l): la residencia responde al aviso del estudiante. El permiso `payments.residence` sale de `residence_users` real.
 * «Volver a habilitar» solo el dueño (re-congela datos de cobro). Nada cambia el estado de la solicitud.
 */
const NORTE = "res-norte";
const CBU = "CBU 0170099220000067797370 alias casa.norte";

function world(over: { app?: Row; payment?: Row } = {}): Record<string, Row[]> {
  return {
    residences: [{ id: NORTE, name: "Norte", reservation_payment_modes: ["enabled_methods", "whatsapp_direct"], accepted_payment_methods: ["transfer_ars", "mercadopago"] }],
    residence_collection_accounts: [
      { id: "a1", residence_id: NORTE, method_key: "transfer_ars", method_label: null, details: CBU, pending_details: null },
      { id: "a2", residence_id: NORTE, method_key: "mercadopago", method_label: null, details: "norte.mp", pending_details: null },
    ],
    application_snapshots: [{ id: "snap-1", reservation_payment_amount_usd: 300, reservation_payment_amount_ars: 450000, monthly_price_usd: 300, exchange_rate_ars_per_usd: 1500 }],
    application_requests: [
      {
        id: "app-1",
        status: "residence_payment_pending",
        residence_id: NORTE,
        student_profile_id: "sp-1",
        contact_target: "student",
        collection_mode: "enabled_methods",
        snapshot_final_id: "snap-1",
        snapshot_original_id: "snap-1",
        payment_deadline_at: "2026-01-01T00:00:00Z",
        preferred_payment_method: "transfer_ars",
        ...over.app,
      },
    ],
    external_residence_payments: [
      {
        id: "pay-1",
        application_request_id: "app-1",
        status: "student_reported_paid",
        chosen_method: "transfer_ars",
        instructions_snapshot: `Transferencia en pesos\n${CBU}`,
        student_reported_paid_at: "2026-11-20T10:00:00Z",
        student_payment_issue_at: null,
        student_payment_issue_resolved_at: null,
        student_proof_file_id: null,
        residence_reminder_sent_at: "x",
        student_reminder_sent_at: "x",
        admin_alert_sent_at: "x",
        admin_escalated_at: "x",
        reopen_count: 0,
        ...over.payment,
      },
    ],
    files: [],
    support_cases: [],
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-pagos", residence_id: NORTE, user_id: "staff-pagos", role: "staff", is_active: true, permissions: permissionsFromChecked(["payments.residence"]) },
      { id: "ru-ro", residence_id: NORTE, user_id: "staff-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
    ],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const pay = () => fake.tables.external_residence_payments[0];
const app = () => fake.tables.application_requests[0];
const writes = () => fake.log.filter((l) => l.op !== "select");
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};
const dispute = (actor: string, reason: unknown = "No figura en mi cuenta del banco", termsAccepted = true) =>
  disputeReportedResidencePaymentCore(fake.client, { actorUserId: actor, applicationId: "app-1", reason, termsAccepted });
const resolve = (actor: string, resolution: unknown, chosenMethod?: unknown) =>
  resolveStudentPaymentIssueCore(fake.client, { actorUserId: actor, applicationId: "app-1", resolution, chosenMethod });

beforeEach(() => {
  audits.length = 0;
  adminNotices.length = 0;
  studentNotices.length = 0;
  collectionNotices.length = 0;
  boot();
});

describe("«No recibí el pago»", () => {
  it("pasa el pago a disputed con motivo, abre el caso de Soporte, audita y avisa al estudiante; la solicitud no cambia", async () => {
    expect(await dispute("ricardo")).toEqual({ ok: true });
    expect(pay()).toMatchObject({ status: "disputed", dispute_reason: "No figura en mi cuenta del banco" });
    expect(app().status).toBe("residence_payment_pending");
    expect(fake.tables.support_cases).toHaveLength(1);
    expect(fake.tables.support_cases[0]).toMatchObject({ topic: "residence_payment", residence_id: NORTE, related_entity_type: "application_requests", related_entity_id: "app-1", opened_by_user_id: "ricardo" });
    expect(String(fake.tables.support_cases[0].description)).not.toContain("CBU");
    expect(audits.map((a) => a.action)).toEqual(["support_case_opened", "residence_payment_disputed"]);
    expect(adminNotices).toHaveLength(1);
    expect(studentNotices).toHaveLength(1);
    expect(studentNotices[0].student.body).not.toMatch(/garantiz|reserva confirmada/i);
  });

  it("el staff con payments.residence puede; sin el permiso no, y no se escribe nada", async () => {
    expect(await dispute("staff-pagos")).toEqual({ ok: true });
    boot();
    const res = await dispute("staff-lectura");
    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
    boot();
    expect((await dispute("otro-usuario")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("el motivo (mínimo 10) y el alcance de Soporte son obligatorios", async () => {
    expect((await dispute("ricardo", "corto")).ok).toBe(false);
    expect((await dispute("ricardo", null)).ok).toBe(false);
    expect((await dispute("ricardo", "No figura en mi cuenta", false)).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("solo sobre un pago en student_reported_paid y una solicitud en residence_payment_pending", async () => {
    for (const [a, p] of [[{}, { status: "pending", student_reported_paid_at: null }], [{}, { status: "disputed" }], [{ status: "converted_to_reservation" }, {}]] as [Row, Row][]) {
      boot(world({ app: a, payment: p }));
      expect((await dispute("ricardo")).ok).toBe(false);
      expect(writes()).toEqual([]);
    }
  });

  it("un segundo registro no duplica el caso ni el aviso", async () => {
    await dispute("ricardo");
    expect((await dispute("ricardo")).ok).toBe(false); // ya está disputed
    expect(fake.tables.support_cases).toHaveLength(1);
  });

  it("si el caso no se puede abrir, se deshace la disputa", async () => {
    boot();
    const clone = createInMemorySupabase(world(), { failInsert: { support_cases: { code: "XX000", message: "boom" } } });
    const res = await disputeReportedResidencePaymentCore(clone.client, { actorUserId: "ricardo", applicationId: "app-1", reason: "No figura en mi cuenta", termsAccepted: true });
    expect(res.ok).toBe(false);
    expect(clone.tables.external_residence_payments[0]).toMatchObject({ status: "student_reported_paid", dispute_reason: null });
  });

  it("sin la migración 0103 (CHECK de topic) la disputa se registra igual, sin caso", async () => {
    const clone = createInMemorySupabase(world(), { failInsert: { support_cases: { code: "23514", message: "violates check constraint" } } });
    const res = await disputeReportedResidencePaymentCore(clone.client, { actorUserId: "ricardo", applicationId: "app-1", reason: "No figura en mi cuenta", termsAccepted: true });
    expect(res).toEqual({ ok: true });
    expect(clone.tables.external_residence_payments[0].status).toBe("disputed");
  });
});

describe("responder «No pude realizar el pago»", () => {
  const open = { student_payment_issue_at: "2026-11-20T10:00:00Z", student_payment_issue_reason: "no pude", status: "pending", student_reported_paid_at: null };

  it("Volver a habilitar: re-congela datos APROBADOS, reinicia el plazo, cierra el aviso y limpia las marcas", async () => {
    boot(world({ payment: open }));
    const before = Date.now();
    expect(await resolve("ricardo", "reenable_payment", "mercadopago")).toEqual({ ok: true });
    expect(pay()).toMatchObject({ chosen_method: "mercadopago", expected_amount_usd: 300, instructions_snapshot: "MercadoPago\nnorte.mp", residence_reminder_sent_at: null, student_reminder_sent_at: null, admin_alert_sent_at: null, admin_escalated_at: null, reopen_count: 1 });
    expect(pay().student_payment_issue_resolved_at).toBeTruthy();
    expect(Date.parse(String(app().payment_deadline_at))).toBeGreaterThanOrEqual(before + 47.9 * 3_600_000);
    expect(app()).toMatchObject({ status: "residence_payment_pending", collection_mode: "enabled_methods" });
    expect(collectionNotices).toEqual([expect.objectContaining({ mode: "enabled_methods", methodLabel: "MercadoPago" })]);
    expect(JSON.stringify(audits)).not.toContain("norte.mp");
  });

  it("tope de reaperturas (DR66): la 3.ª vez no vuelve a habilitar y no escribe nada; «Contactar por WhatsApp» sigue disponible", async () => {
    boot(world({ payment: { ...open, reopen_count: 2 } }));
    expect(await resolve("ricardo", "reenable_payment", "mercadopago")).toEqual({ ok: false, error: RESIDENCE_REOPEN_CAP_MESSAGE });
    expect(writes()).toEqual([]);
    expect(pay()).toMatchObject({ reopen_count: 2, student_payment_issue_resolved_at: null });
    expect(await resolve("ricardo", "contact_whatsapp")).toEqual({ ok: true });
    expect(pay().reopen_count).toBe(2);
  });

  it("cada «Volver a habilitar» suma 1 y la 2.ª todavía pasa (de 1 a 2)", async () => {
    boot(world({ payment: { ...open, reopen_count: 1 } }));
    expect(await resolve("ricardo", "reenable_payment")).toEqual({ ok: true });
    expect(pay().reopen_count).toBe(2);
    expect(JSON.stringify(audits)).toContain('"reopen_count":2');
  });

  it("«Contactar por WhatsApp» no cuenta como reapertura", async () => {
    boot(world({ payment: open }));
    await resolve("staff-pagos", "contact_whatsapp");
    expect(pay().reopen_count).toBe(0);
  });

  it("sin medio elegido conserva el anterior", async () => {
    boot(world({ payment: open }));
    await resolve("ricardo", "reenable_payment");
    expect(pay().chosen_method).toBe("transfer_ars");
  });

  it("Contactar por WhatsApp: la solicitud pasa a whatsapp_direct, se borra el texto congelado y se reinicia el plazo", async () => {
    boot(world({ payment: open }));
    expect(await resolve("staff-pagos", "contact_whatsapp")).toEqual({ ok: true });
    expect(app()).toMatchObject({ collection_mode: "whatsapp_direct", status: "residence_payment_pending" });
    expect(pay()).toMatchObject({ instructions_snapshot: null, admin_alert_sent_at: null });
    expect(pay().student_payment_issue_resolved_at).toBeTruthy();
    expect(collectionNotices).toEqual([expect.objectContaining({ mode: "whatsapp_direct" })]);
  });

  it("el staff NO puede volver a habilitar (solo el dueño congela datos de cobro) y no se escribe nada", async () => {
    boot(world({ payment: open }));
    expect(await resolve("staff-pagos", "reenable_payment")).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("un medio sin datos aprobados no pasa", async () => {
    const w = world({ payment: open });
    w.residence_collection_accounts[1] = { id: "a2", residence_id: NORTE, method_key: "mercadopago", method_label: null, details: null, pending_details: "nuevo" };
    boot(w);
    expect((await resolve("ricardo", "reenable_payment", "mercadopago")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("exige un aviso abierto, la resolución válida y el permiso", async () => {
    boot(); // sin aviso abierto (payment student_reported_paid)
    expect((await resolve("ricardo", "contact_whatsapp")).ok).toBe(false);
    boot(world({ payment: open }));
    expect((await resolve("ricardo", "borrar_todo")).ok).toBe(false);
    expect((await resolve("staff-lectura", "contact_whatsapp")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("no se puede responder dos veces", async () => {
    boot(world({ payment: open }));
    await resolve("ricardo", "reenable_payment");
    expect((await resolve("ricardo", "reenable_payment")).ok).toBe(false);
  });
});

describe("comprobante del estudiante", () => {
  function storageClient(over: { fileOver?: Row; payment?: Row } = {}) {
    const w = world({ payment: { student_proof_file_id: "file-1", ...over.payment } });
    w.files = [{ id: "file-1", bucket: "payment-proofs", storage_path: "app-1/student-proof-x.pdf", document_type: "student_payment_proof_to_residence", related_entity_type: "application_requests", related_entity_id: "app-1", ...over.fileOver }];
    boot(w);
    const signed: string[] = [];
    Object.assign(fake.client, { storage: { from: () => ({ createSignedUrl: async (p: string, s: number) => (signed.push(`${p}:${s}`), { data: { signedUrl: "https://signed.test/x" }, error: null }) }) } });
    return signed;
  }
  const open = (actor: string) => openStudentPaymentProofCore(fake.client, { actorUserId: actor, applicationId: "app-1" });

  it("el dueño y el staff con payments.residence reciben un link corto y queda registrado", async () => {
    const signed = storageClient();
    expect(await open("ricardo")).toEqual({ ok: true, url: "https://signed.test/x" });
    expect(signed).toEqual(["app-1/student-proof-x.pdf:300"]);
    expect(audits[0]).toMatchObject({ action: "residence_payment_proof_accessed", entityType: "files" });
    expect((await open("staff-pagos")).ok).toBe(true);
  });

  it("sin permiso, sin sesión de la residencia o sin comprobante: nada", async () => {
    const signed = storageClient();
    for (const actor of ["staff-lectura", "estudiante", "otra-residencia"]) {
      expect((await open(actor)).ok).toBe(false);
    }
    expect(signed).toEqual([]);
    storageClient({ payment: { student_proof_file_id: null } });
    expect((await open("ricardo")).ok).toBe(false);
  });

  it("el archivo tiene que ser el comprobante de ESA solicitud", async () => {
    const signed = storageClient({ fileOver: { related_entity_id: "otra-solicitud" } });
    expect((await open("ricardo")).ok).toBe(false);
    storageClient({ fileOver: { bucket: "student-documents" } });
    expect((await open("ricardo")).ok).toBe(false);
    expect(signed).toEqual([]);
  });
});
