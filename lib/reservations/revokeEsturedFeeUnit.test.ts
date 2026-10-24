import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const createAuditLog = vi.hoisted(() => vi.fn(async () => true));
const alertAdminsOfAuditFailure = vi.hoisted(() => vi.fn(async () => undefined));
const createNotification = vi.hoisted(() => vi.fn(async () => undefined));
const openFeeRevocationSupportCase = vi.hoisted(() => vi.fn(async () => ({ ok: false as const })));
vi.mock("@/lib/audit", () => ({ createAuditLog, alertAdminsOfAuditFailure }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));
vi.mock("@/lib/revocations/openRevocationSupportCase", () => ({ openFeeRevocationSupportCase }));

import { REVOCATION_ADULT_STUDENT_ONLY_ERROR } from "@/lib/revocations/copy";
import { revokeEsturedFee } from "@/lib/reservations/revokeEsturedFee";

type Call = { table: string; op: string; payload?: Record<string, unknown>; filters: [string, unknown][] };

/** Cliente falso (sin base real): el `update` de reservations devuelve `revokedRows`. */
function fakeAdmin(opts: { reservationStatus?: string; paidDaysAgo?: number; revokedRows?: { id: string }[]; payerUserId?: string; studentUserId?: string; activeLink?: boolean; birthDate?: string | null; receiptError?: boolean; auditOk?: boolean }) {
  const calls: Call[] = [];
  const paidAt = new Date(Date.now() - (opts.paidDaysAgo ?? 1) * 24 * 3_600_000).toISOString();
  const rows: Record<string, unknown> = {
    reservations: {
      id: "res-1",
      status: opts.reservationStatus ?? "confirmed",
      student_profile_id: "sp-1",
      estured_fee_payment_id: "fee-1",
      booking_receipt_id: "rec-1",
      residences: { name: "Residencia Norte" },
    },
    estured_fee_payments: { id: "fee-1", status: "paid", paid_at: paidAt, payer_user_id: opts.payerUserId ?? "payer" },
    student_profiles: { id: "sp-1", user_id: opts.studentUserId ?? "student", birth_date: opts.birthDate === undefined ? "2012-05-10" : opts.birthDate },
    family_links: opts.activeLink === false ? null : { id: "link-1", family_members: { user_id: "payer", first_name: "Marta" } },
  };
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      chain.select = () => (call.op === "update" ? Promise.resolve({ data: opts.revokedRows ?? [{ id: "res-1" }], error: null }) : chain);
      chain.eq = (c: string, v: unknown) => (call.filters.push([c, v]), chain);
      chain.maybeSingle = () => Promise.resolve({ data: rows[table] ?? null, error: null });
      chain.single = () => Promise.resolve({ data: rows[table] ?? null, error: null });
      chain.update = (payload: Record<string, unknown>) => ((call.op = "update"), (call.payload = payload), chain);
      chain.limit = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: table === "booking_receipts" && opts.receiptError ? { message: "boom" } : null });
      return chain;
    },
  };
  return { admin: client as unknown as SupabaseClient, calls };
}

const base = { reservationId: "res-1", reason: "Conseguí otro lugar.", acknowledgeUnderstanding: true };

beforeEach(() => {
  createAuditLog.mockClear();
  alertAdminsOfAuditFailure.mockClear();
  createNotification.mockClear();
  openFeeRevocationSupportCase.mockClear();
});

describe("revokeEsturedFee (unitario, DR6)", () => {
  it("exige el checkbox único de entendimiento", async () => {
    const { admin } = fakeAdmin({});
    const r = await revokeEsturedFee(admin, { ...base, actorUserId: "payer", acknowledgeUnderstanding: false });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/entendiste/i) });
  });

  it("revoca con UPDATE condicional por estado `confirmed`, anula el comprobante, audita y abre el caso (best-effort)", async () => {
    const { admin, calls } = fakeAdmin({});
    const r = await revokeEsturedFee(admin, { ...base, actorUserId: "payer" });
    expect(r).toEqual({ ok: true });
    const update = calls.find((c) => c.table === "reservations" && c.op === "update")!;
    expect(update.payload).toMatchObject({ status: "cancelled_by_student", cancellation_reason_code: "student_revocation_right" });
    expect(update.filters).toEqual(expect.arrayContaining([["id", "res-1"], ["status", "confirmed"]]));
    expect(calls.some((c) => c.table === "booking_receipts" && c.op === "update")).toBe(true);
    expect(createAuditLog).toHaveBeenCalledWith(admin, expect.objectContaining({ action: "estured_fee_revoked", actorRole: "family_member" }));
    expect(openFeeRevocationSupportCase).toHaveBeenCalledWith(admin, expect.objectContaining({ reservationId: "res-1", actorRole: "family_member", residenceName: "Residencia Norte" }));
  });

  it("si el caso de Soporte no se pudo abrir, la revocación igual vale", async () => {
    openFeeRevocationSupportCase.mockResolvedValueOnce({ ok: false });
    const { admin } = fakeAdmin({});
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
  });

  it("doble clic o dos pestañas: si la reserva ya no está confirmada el update no afecta filas y no audita ni abre caso", async () => {
    const { admin } = fakeAdmin({ revokedRows: [] });
    const r = await revokeEsturedFee(admin, { ...base, actorUserId: "payer" });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/ya no está/i) });
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(openFeeRevocationSupportCase).not.toHaveBeenCalled();
  });

  it("un familiar vinculado que no es el pagador (ni el estudiante) no puede revocar", async () => {
    const { admin } = fakeAdmin({});
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "familiar-no-pagador" })).toMatchObject({ ok: false, error: expect.stringMatching(/no te pertenece/i) });
  });

  it("fuera de los 10 días corridos se bloquea sin cambios", async () => {
    const { admin, calls } = fakeAdmin({ paidDaysAgo: 10.5 });
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toMatchObject({ ok: false, error: expect.stringMatching(/plazo de 10 días/i) });
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("el pagador sin vínculo familiar activo con el estudiante no puede revocar", async () => {
    const { admin, calls } = fakeAdmin({ activeLink: false });
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toMatchObject({ ok: false, error: expect.stringMatching(/no te pertenece/i) });
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("si revoca el familiar pagador vinculado, el estudiante recibe siempre un aviso con el nombre del familiar", async () => {
    const { admin } = fakeAdmin({});
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    expect(createNotification).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ userId: "student", body: expect.stringMatching(/Marta revocó el fee de tu reserva en Residencia Norte/) }),
    );
  });

  describe("DR6 (i): el familiar pagador solo revoca si el estudiante es menor de edad", () => {
    afterEach(() => vi.useRealTimers());

    it("familiar pagador + estudiante menor: puede revocar", async () => {
      const { admin } = fakeAdmin({ birthDate: "2012-05-10" });
      expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    });

    it("familiar pagador + estudiante mayor: rechazado sin cambios ni avisos", async () => {
      const { admin, calls } = fakeAdmin({ birthDate: "2000-01-01" });
      expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: false, error: REVOCATION_ADULT_STUDENT_ONLY_ERROR });
      expect(calls.some((c) => c.op === "update")).toBe(false);
      expect(createAuditLog).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
      expect(openFeeRevocationSupportCase).not.toHaveBeenCalled();
    });

    it("el mensaje de rechazo es accionable y no revela datos del estudiante", () => {
      expect(REVOCATION_ADULT_STUDENT_ONLY_ERROR).toMatch(/desde su cuenta.*Soporte/);
      expect(REVOCATION_ADULT_STUDENT_ONLY_ERROR).not.toMatch(/\d/);
    });

    it("familiar sin vínculo activo: rechazado aunque el estudiante sea menor", async () => {
      const { admin, calls } = fakeAdmin({ activeLink: false, birthDate: "2012-05-10" });
      expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toMatchObject({ ok: false, error: expect.stringMatching(/no te pertenece/i) });
      expect(calls.some((c) => c.op === "update")).toBe(false);
    });

    it("estudiante mayor de edad: puede revocar ella misma", async () => {
      const { admin } = fakeAdmin({ birthDate: "2000-01-01" });
      expect(await revokeEsturedFee(admin, { ...base, actorUserId: "student" })).toEqual({ ok: true });
    });

    it("sin fecha de nacimiento se trata como menor (misma convención que el resto del proyecto)", async () => {
      const { admin } = fakeAdmin({ birthDate: null });
      expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    });

    it("borde: cumple 18 el mismo día de la revocación -> mayor (rechazado); un día antes -> menor (ok)", async () => {
      vi.useFakeTimers();
      // 15/06/2026 12:00 en Buenos Aires (UTC-3): hoy cumple 18 quien nació el 15/06/2008.
      vi.setSystemTime(new Date("2026-06-15T15:00:00Z"));
      const sameDay = fakeAdmin({ birthDate: "2008-06-15", paidDaysAgo: 1 });
      expect(await revokeEsturedFee(sameDay.admin, { ...base, actorUserId: "payer" })).toEqual({ ok: false, error: REVOCATION_ADULT_STUDENT_ONLY_ERROR });
      const dayBefore = fakeAdmin({ birthDate: "2008-06-16", paidDaysAgo: 1 });
      expect(await revokeEsturedFee(dayBefore.admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    });
  });

  it("si revoca el propio estudiante no hay aviso ni chequeo de vínculo", async () => {
    const { admin, calls } = fakeAdmin({ activeLink: false });
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "student" })).toEqual({ ok: true });
    expect(createNotification).not.toHaveBeenCalled();
    expect(calls.some((c) => c.table === "family_links")).toBe(false);
    expect(createAuditLog).toHaveBeenCalledWith(admin, expect.objectContaining({ actorRole: "student" }));
  });

  it("usa un único instante para `cancelled_at` y el comprobante anulado", async () => {
    const { admin, calls } = fakeAdmin({});
    await revokeEsturedFee(admin, { ...base, actorUserId: "payer" });
    const reservationAt = calls.find((c) => c.table === "reservations" && c.op === "update")!.payload!.cancelled_at;
    const voidedAt = calls.find((c) => c.table === "booking_receipts" && c.op === "update")!.payload!.voided_at;
    expect(reservationAt).toBe(voidedAt);
  });

  it("si falla el log de auditoría alerta a los admins pero la revocación vale", async () => {
    createAuditLog.mockResolvedValueOnce(false);
    const { admin } = fakeAdmin({});
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    expect(alertAdminsOfAuditFailure).toHaveBeenCalledWith(admin, expect.objectContaining({ action: "estured_fee_revoked", entityId: "res-1" }));
  });

  it("si falla anular el comprobante igual registra la revocación (se loguea el error)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { admin } = fakeAdmin({ receiptError: true });
    expect(await revokeEsturedFee(admin, { ...base, actorUserId: "payer" })).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("booking receipt void failed"), expect.anything());
    spy.mockRestore();
  });
});
