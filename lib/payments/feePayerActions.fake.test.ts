import { beforeEach, describe, expect, it, vi } from "vitest";

type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; oldValue?: unknown; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
const adminNotices = vi.hoisted(() => [] as { title: string; body: string; entityType: string; entityId: string }[]);
vi.mock("@/lib/notifications/notifyAdminsSafe", () => ({
  notifyAdminsSafe: async (_a: unknown, p: { title: string; body: string; entityType: string; entityId: string }) => void adminNotices.push(p),
}));
const link = vi.hoisted(() => ({ value: null as null | { linkId: string; studentProfileId: string; permissions: Record<string, unknown> } }));
vi.mock("@/lib/family/access", () => ({ loadActiveFamilyLink: async (_a: unknown, userId: string) => (userId === "u-family" ? link.value : null) }));
vi.mock("@/lib/security/uploadLimits", () => ({ PROOF_UPLOAD_LIMIT_MESSAGE: "límite", proofUploadAllowed: async () => true }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { chooseFeePaymentMethodCore, reportFeePaymentIssueCore } from "@/lib/payments/feePayerActions";
import { registerManualFeePaymentCore } from "@/lib/payments/registerFeePayment";

/** DR64 (b), (c) y (e): elegir medio, «Ya pagué» y «No pude realizar el pago». Cliente en memoria; el actor sale de la base. */
const CBU_ARS = "CBU 0000003100012345678901 alias estured.cobro";
const CBU_USD = "CBU 0000003100099999999999 titular EstuRed USD";
const NOW = new Date("2026-11-21T12:00:00.000Z");
const SECRET_MARKS = { payer_reminder_sent_at: "2026-11-20T00:00:00Z", admin_reminder_sent_at: "2026-11-20T00:00:00Z", admin_alert_sent_at: "2026-11-20T00:00:00Z" };

function world(over: { fee?: Row; methods?: Row[]; settings?: Row[]; app?: Row; reservation?: Row } = {}): Record<string, Row[]> {
  return {
    application_requests: [{ id: "app-1", status: "converted_to_reservation", residence_id: "res-1", student_profile_id: "sp-1", ...over.app }],
    student_profiles: [{ id: "sp-1", user_id: "u-student" }],
    reservations: [{ id: "resv-1", application_request_id: "app-1", status: "pending_estured_fee", estured_fee_payment_id: "fee-1", ...over.reservation }],
    estured_fee_payments: [
      {
        id: "fee-1",
        status: "pending_payment_method",
        payer_user_id: "u-student",
        expires_at: "2030-01-01T00:00:00Z",
        chosen_method: null,
        payment_currency: "ARS",
        instructions_snapshot: null,
        fee_amount_ars: 70000,
        fee_amount_usd: null,
        fee_base_usd: 1000,
        fee_base_ars: 1_400_000,
        student_reported_paid_at: null,
        student_payment_issue_at: null,
        student_payment_issue_reason: null,
        student_payment_issue_resolved_at: null,
        manual_payment_file_id: null,
        payment_channel: null,
        ...SECRET_MARKS,
        ...over.fee,
      },
    ],
    estured_fee_collection_methods: over.methods ?? [
      { id: "m1", method_key: "transfer_ars", method_label: null, details: CBU_ARS, currency: "ARS", is_enabled: true, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" },
      { id: "m2", method_key: "transfer_usd", method_label: null, details: CBU_USD, currency: "USD", is_enabled: true, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" },
      { id: "m3", method_key: "belo", method_label: null, details: "belo.estured", currency: "ARS", is_enabled: false, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" },
    ],
    payment_settings: over.settings ?? [],
    files: [],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const fee = () => fake.tables.estured_fee_payments[0];
const writes = () => fake.log.filter((l) => l.op !== "select");
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};

beforeEach(() => {
  audits.length = 0;
  adminNotices.length = 0;
  link.value = { linkId: "l-1", studentProfileId: "sp-1", permissions: { can_pay_estured_fee: true } };
  boot();
});

describe("elegir el medio del fee", () => {
  it("el estudiante pagador elige: guarda medio, moneda y congela los datos de ESE momento", async () => {
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(res).toEqual({ ok: true });
    expect(fee()).toMatchObject({ chosen_method: "transfer_ars", payment_currency: "ARS", instructions_snapshot: `Transferencia en pesos\n${CBU_ARS}` });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "estured_fee_method_chosen", actorRole: "student" });
    expect(JSON.stringify(audits)).not.toContain("0000003100012345678901");
  });

  it("si el admin cambia los datos después, el fee conserva los congelados", async () => {
    await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    fake.tables.estured_fee_collection_methods[0].details = "CBU NUEVO";
    expect(String(fee().instructions_snapshot)).toContain("0000003100012345678901");
  });

  it("medio en USD: la moneda del medio y el monto salen del tipo de cambio del snapshot", async () => {
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_usd", now: NOW });
    expect(res.ok).toBe(true);
    expect(fee()).toMatchObject({ chosen_method: "transfer_usd", payment_currency: "USD", fee_amount_usd: 50 });
  });

  it("cambiar de medio mientras no informó el pago vuelve a congelar", async () => {
    await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_usd", now: NOW });
    expect(fee()).toMatchObject({ chosen_method: "transfer_usd", payment_currency: "USD" });
    expect(String(fee().instructions_snapshot)).toContain("Transferencia en dólares");
  });

  it("el familiar pagador (vínculo activo con can_pay_estured_fee) también elige", async () => {
    boot(world({ fee: { payer_user_id: "u-family" } }));
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-family", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(res.ok).toBe(true);
    expect(audits[0].actorRole).toBe("family_member");
  });

  it("el familiar sin el permiso (apagado después de designarlo) no elige", async () => {
    boot(world({ fee: { payer_user_id: "u-family" } }));
    link.value = { linkId: "l-1", studentProfileId: "sp-1", permissions: { can_pay_estured_fee: false } };
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-family", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(res).toEqual({ ok: false, error: "Ya no tenés permitido pagar el fee de esta reserva." });
    expect(writes()).toHaveLength(0);
  });

  it("el beneficiario cuyo fee paga el familiar no elige (no es el pagador designado)", async () => {
    boot(world({ fee: { payer_user_id: "u-family" } }));
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(res).toMatchObject({ ok: false });
    expect(writes()).toHaveLength(0);
  });

  it("otro usuario y el staff de la residencia no son actores (sin pista de si existe)", async () => {
    for (const userId of ["u-other", "u-residence-staff", "u-residence-owner"]) {
      const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: userId, applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
      expect(res).toEqual({ ok: false, error: "No encontramos esa solicitud." });
    }
    expect(writes()).toHaveLength(0);
    expect(fee().instructions_snapshot).toBeNull();
  });

  it("un medio no habilitado o fuera del catálogo se rechaza", async () => {
    const off = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "belo", now: NOW });
    expect(off).toMatchObject({ ok: false, error: expect.stringContaining("no está habilitado") });
    const missing = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "paypal", now: NOW });
    expect(missing.ok).toBe(false);
    const bad = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "no_existe", now: NOW });
    expect(bad.ok).toBe(false);
    expect(fee().chosen_method).toBeNull();
  });

  it("sin medios habilitados rige el respaldo: payment_settings como «Transferencia en pesos»", async () => {
    boot(world({ methods: [], settings: [{ id: "s1", account_holder: "EstuRed SAS", alias: "estured.demo", cbu: "0".repeat(22), bank_name: "Banco X", holder_cuit: null, instructions: null, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" }] }));
    const ok = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(ok.ok).toBe(true);
    expect(String(fee().instructions_snapshot)).toContain("Titular: EstuRed SAS");
    const other = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "belo", now: NOW });
    expect(other.ok).toBe(false);
  });

  it("con una fila transfer_ars en la tabla, deshabilitada, el respaldo NO la resucita: el cobro se frena", async () => {
    boot(world({ methods: [{ id: "m1", method_key: "transfer_ars", method_label: null, details: CBU_ARS, currency: "ARS", is_enabled: false, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" }], settings: [{ id: "s1", account_holder: "EstuRed SAS", alias: "estured.demo", cbu: "0".repeat(22), bank_name: "Banco X", holder_cuit: null, instructions: null, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" }] }));
    const res = await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("no está habilitado") });
    expect(fee().chosen_method).toBeNull();
  });

  it("no elige con el plazo vencido, con el pago ya informado ni con un aviso abierto", async () => {
    boot(world({ fee: { expires_at: "2020-01-01T00:00:00Z" } }));
    expect(await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("venció") });
    boot(world({ fee: { status: "pending_manual_payment" } }));
    expect(await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("Ya informaste") });
    boot(world({ fee: { student_payment_issue_at: "2026-11-21T10:00:00Z" } }));
    expect(await chooseFeePaymentMethodCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", methodKey: "transfer_ars", now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("Esperá la respuesta") });
    expect(writes()).toHaveLength(0);
  });
});

describe("«No pude realizar el pago»", () => {
  it("marca el aviso, limpia las marcas del job, audita sin el motivo y avisa a los admin", async () => {
    const res = await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "Me rechazó la tarjeta del banco", now: NOW });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(fee()).toMatchObject({
      status: "pending_payment_method",
      student_payment_issue_at: NOW.toISOString(),
      student_payment_issue_reason: "Me rechazó la tarjeta del banco",
      student_payment_issue_resolved_at: null,
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
    });
    expect(audits[0]).toMatchObject({ action: "estured_fee_payment_issue_reported", actorRole: "student", newValue: { has_reason: true } });
    expect(JSON.stringify(audits)).not.toContain("tarjeta");
    expect(adminNotices).toHaveLength(1);
    expect(adminNotices[0]).toMatchObject({ entityType: "estured_fee_payments", entityId: "fee-1" });
    expect(adminNotices[0].body).not.toContain("tarjeta");
  });

  it("el motivo es opcional; si se escribe, de 10 a 200 caracteres", async () => {
    expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "corto", now: NOW })).toMatchObject({ ok: false });
    expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", reason: "x".repeat(201), now: NOW })).toMatchObject({ ok: false });
    expect(writes()).toHaveLength(0);
    expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW })).toEqual({ ok: true, alreadyReported: false });
    expect(fee().student_payment_issue_reason).toBeNull();
  });

  it("es idempotente: un segundo toque no repite aviso ni auditoría", async () => {
    await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW });
    const again = await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW });
    expect(again).toEqual({ ok: true, alreadyReported: true });
    expect(adminNotices).toHaveLength(1);
    expect(audits).toHaveLength(1);
  });

  it("un aviso nuevo tras la respuesta del admin pisa el anterior y reabre", async () => {
    boot(world({ fee: { student_payment_issue_at: "2026-11-20T10:00:00Z", student_payment_issue_resolved_at: "2026-11-20T11:00:00Z", admin_alert_sent_at: "2026-11-20T12:00:00Z" } }));
    const res = await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW });
    expect(res).toEqual({ ok: true, alreadyReported: false });
    expect(fee()).toMatchObject({ student_payment_issue_at: NOW.toISOString(), student_payment_issue_resolved_at: null, admin_alert_sent_at: null });
  });

  it("el familiar pagador avisa; otro usuario y el staff de la residencia no", async () => {
    boot(world({ fee: { payer_user_id: "u-family" } }));
    expect((await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-family", applicationId: "app-1", now: NOW })).ok).toBe(true);
    boot(world());
    adminNotices.length = 0;
    for (const userId of ["u-other", "u-residence-staff"]) {
      expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: userId, applicationId: "app-1", now: NOW })).toEqual({ ok: false, error: "No encontramos esa solicitud." });
    }
    expect(writes()).toHaveLength(0);
    expect(adminNotices).toHaveLength(0);
  });

  it("no avisa con el pago ya informado ni con el plazo vencido", async () => {
    boot(world({ fee: { status: "pending_manual_payment" } }));
    expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("Ya informaste") });
    boot(world({ fee: { expires_at: "2020-01-01T00:00:00Z" } }));
    expect(await reportFeePaymentIssueCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("venció") });
    expect(writes()).toHaveLength(0);
  });
});

/** Storage mínimo (el fake no lo trae). */
function withStorage() {
  const uploaded: string[] = [];
  const removed: string[] = [];
  Object.assign(fake.client, {
    storage: { from: () => ({ upload: async (path: string) => (uploaded.push(path), { error: null }), remove: async (paths: string[]) => (removed.push(...paths), { error: null }) }) },
  });
  return { uploaded, removed };
}
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], "comprobante.pdf", { type: "application/pdf" });
function registerForm(over: { file?: File | null; ack?: boolean } = {}) {
  const fd = new FormData();
  if (over.file !== null) fd.set("file", over.file ?? pdf());
  fd.set("payer_billing_name", "Juan Pérez");
  fd.set("payer_iva_condition", "consumidor_final");
  if (over.ack !== false) fd.set("acknowledge_no_refund", "on");
  return fd;
}

describe("«Ya pagué» (comprobante obligatorio)", () => {
  const chosen = { chosen_method: "transfer_ars", instructions_snapshot: `Transferencia en pesos\n${CBU_ARS}` };

  it("con medio elegido y comprobante: pasa a pending_manual_payment, marca student_reported_paid_at y avisa", async () => {
    boot(world({ fee: chosen }));
    const { uploaded } = withStorage();
    const res = await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW });
    expect(res).toEqual({ ok: true });
    expect(uploaded).toHaveLength(1);
    expect(fee()).toMatchObject({
      status: "pending_manual_payment",
      student_reported_paid_at: NOW.toISOString(),
      payment_channel: "Transferencia en pesos",
      payer_billing_name: "Juan Pérez",
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
      chosen_method: "transfer_ars",
    });
    expect(fee().manual_payment_file_id).toBeTruthy();
    expect(audits[0]).toMatchObject({ action: "estured_fee_manual_payment_registered", actorRole: "student" });
    expect(JSON.stringify(audits)).not.toContain("0000003100012345678901");
    expect(adminNotices).toHaveLength(1);
  });

  it("sin comprobante no registra nada (DR8 no se relaja)", async () => {
    boot(world({ fee: chosen }));
    withStorage();
    const res = await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm({ file: null }), now: NOW });
    expect(res).toEqual({ ok: false, error: "Adjuntá el comprobante del pago." });
    expect(fee().status).toBe("pending_payment_method");
    expect(fee().student_reported_paid_at).toBeNull();
    expect(adminNotices).toHaveLength(0);
  });

  it("si el medio elegido se deshabilitó después, pide elegir otro y no sube nada", async () => {
    boot(world({ fee: chosen, methods: [{ id: "m1", method_key: "transfer_ars", method_label: null, details: CBU_ARS, currency: "ARS", is_enabled: false, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" }] }));
    const { uploaded } = withStorage();
    const res = await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("Elegí otro medio") });
    expect(uploaded).toHaveLength(0);
    expect(fee().status).toBe("pending_payment_method");
    expect(writes()).toHaveLength(0);
  });

  it("exige medio elegido y rechaza con un aviso «No pude realizar el pago» abierto", async () => {
    boot();
    withStorage();
    expect(await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("Elegí con qué medio") });
    boot(world({ fee: { ...chosen, student_payment_issue_at: "2026-11-21T10:00:00Z" } }));
    withStorage();
    expect(await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW })).toMatchObject({ ok: false, error: expect.stringContaining("Esperá la respuesta") });
    expect(writes()).toHaveLength(0);
  });

  it("el familiar pagador registra; el beneficiario (no pagador), otro usuario y el staff no", async () => {
    boot(world({ fee: { ...chosen, payer_user_id: "u-family" } }));
    withStorage();
    expect((await registerManualFeePaymentCore(fake.client, { actorUserId: "u-family", applicationId: "app-1", formData: registerForm(), now: NOW })).ok).toBe(true);
    expect(audits[0].actorRole).toBe("family_member");

    boot(world({ fee: { ...chosen, payer_user_id: "u-family" } }));
    withStorage();
    for (const userId of ["u-student", "u-other", "u-residence-staff"]) {
      const res = await registerManualFeePaymentCore(fake.client, { actorUserId: userId, applicationId: "app-1", formData: registerForm(), now: NOW });
      expect(res.ok).toBe(false);
    }
    expect(fee().status).toBe("pending_payment_method");
    expect(adminNotices).toHaveLength(1);
  });

  it("un segundo «Ya pagué» no pisa el comprobante", async () => {
    boot(world({ fee: chosen }));
    withStorage();
    await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW });
    const again = await registerManualFeePaymentCore(fake.client, { actorUserId: "u-student", applicationId: "app-1", formData: registerForm(), now: NOW });
    expect(again).toEqual({ ok: false, error: "Ya hay un comprobante registrado para este pago." });
  });
});
