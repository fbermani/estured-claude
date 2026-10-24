import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const createAuditLog = vi.hoisted(() => vi.fn(async () => true));
const alertAdminsOfAuditFailure = vi.hoisted(() => vi.fn(async () => undefined));
const createNotification = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/audit", () => ({ createAuditLog, alertAdminsOfAuditFailure }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));

import { resolveFeeRevocation } from "@/lib/revocations/resolveFeeRevocation";
import type { RevocationResolutionInput } from "@/lib/revocations/evaluateResolution";

type Call = { table: string; op: string; payload?: Record<string, unknown>; filters: [string, string, unknown][] };

const REASON = "MOTIVO-INTERNO-SECRETO: dentro de plazo";

/**
 * Cliente falso: cada tabla responde con su fila fija (`rows`), el `update` de `estured_fee_payments` devuelve `updateResult`, y se
 * registran todas las operaciones con sus filtros (para comprobar el UPDATE condicional y qué se escribe en cada tabla).
 */
function fakeAdmin(opts: {
  reservation?: Record<string, unknown> | null;
  fee?: Record<string, unknown> | null;
  feeError?: { code: string; message: string } | null;
  updateResult?: { data: { id: string }[] | null; error: { code?: string; message: string } | null };
  cases?: { id: string; status: string }[];
  payerLinked?: boolean;
}) {
  const calls: Call[] = [];
  const rows: Record<string, unknown> = {
    reservations: opts.reservation === undefined ? RESERVATION : opts.reservation,
    estured_fee_payments: opts.fee === undefined ? FEE : opts.fee,
    student_profiles: { user_id: "student-user" },
    family_links: opts.payerLinked === false ? null : { id: "link-1" },
  };
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (c: string, v: unknown) => (call.filters.push([c, "eq", v]), chain);
      chain.is = (c: string, v: unknown) => (call.filters.push([c, "is", v]), chain);
      chain.maybeSingle = () =>
        Promise.resolve(
          table === "estured_fee_payments" && opts.feeError
            ? { data: null, error: opts.feeError }
            : { data: rows[table] ?? null, error: null },
        );
      chain.update = (payload: Record<string, unknown>) => {
        call.op = "update";
        call.payload = payload;
        const updateChain: Record<string, unknown> = {};
        updateChain.eq = (c: string, v: unknown) => (call.filters.push([c, "eq", v]), updateChain);
        updateChain.is = (c: string, v: unknown) => (call.filters.push([c, "is", v]), updateChain);
        updateChain.select = () => Promise.resolve(opts.updateResult ?? { data: [{ id: "fee-1" }], error: null });
        updateChain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
        return updateChain;
      };
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: table === "support_cases" ? (opts.cases ?? []) : [], error: null });
      return chain;
    },
  };
  return { admin: client as unknown as SupabaseClient, calls };
}

const RESERVATION = {
  id: "res-1",
  status: "cancelled_by_student",
  cancellation_reason_code: "student_revocation_right",
  cancelled_at: "2026-10-20T18:00:00.000Z",
  student_profile_id: "sp-1",
  estured_fee_payment_id: "fee-1",
  residences: { name: "Residencia Norte" },
};
const FEE = {
  id: "fee-1",
  status: "paid",
  paid_at: "2026-10-20T12:00:00.000Z",
  fee_amount_ars: 67000,
  payer_user_id: "payer-user",
  revocation_resolution: null,
};

const refundInput: RevocationResolutionInput = {
  decision: "refunded",
  internalReason: REASON,
  studentMessage: "Te transferimos el fee.",
  confirmRefundAmountArs: 67000,
  refundMethod: "bank_transfer",
  refundReference: "OP-9",
  refundedOn: new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }),
  justifiedCause: false,
  confirmDenial: false,
};
const params = (input: Partial<RevocationResolutionInput> = {}) => ({
  reservationId: "res-1",
  actorUserId: "admin-1",
  actorRole: "admin" as const,
  input: { ...refundInput, ...input },
});

beforeEach(() => {
  createAuditLog.mockClear().mockResolvedValue(true);
  alertAdminsOfAuditFailure.mockClear();
  createNotification.mockClear();
});

describe("resolveFeeRevocation", () => {
  it("reintegrar: update condicional (paid + sin resolución), auditoría con el motivo y aviso sin el motivo interno", async () => {
    const { admin, calls } = fakeAdmin({});
    const result = await resolveFeeRevocation(admin, params());
    expect(result).toEqual({ ok: true, decision: "refunded" });

    const update = calls.find((c) => c.table === "estured_fee_payments" && c.op === "update")!;
    expect(update.payload).toMatchObject({ status: "refunded", revocation_resolution: "refunded", refund_amount_ars: 67000, revocation_internal_reason: REASON });
    expect(update.filters).toEqual(
      expect.arrayContaining([
        ["id", "eq", "fee-1"],
        ["status", "eq", "paid"],
        ["revocation_resolution", "is", null],
      ]),
    );

    expect(createAuditLog).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        actorUserId: "admin-1",
        actorRole: "admin",
        action: "estured_fee_refunded_after_revocation",
        entityType: "estured_fee_payments",
        entityId: "fee-1",
        reasonText: REASON,
      }),
    );

    // Avisa al estudiante y al pagador (distintos), nunca con el motivo interno.
    const recipients = createNotification.mock.calls.map((c) => (c as unknown as [unknown, { userId: string }])[1].userId).sort();
    expect(recipients).toEqual(["payer-user", "student-user"]);
    for (const call of createNotification.mock.calls) {
      const entry = (call as unknown as [unknown, { body: string; title: string; relatedEntityType: string }])[1];
      expect(entry.body).not.toContain("MOTIVO-INTERNO-SECRETO");
      expect(entry.relatedEntityType).toBe("fee_revocations");
    }
  });

  it("denegar: el fee no se toca (sin status ni datos de reintegro) y el aviso solo lleva el mensaje al estudiante", async () => {
    const { admin, calls } = fakeAdmin({});
    const result = await resolveFeeRevocation(
      admin,
      params({ decision: "denied", justifiedCause: true, confirmDenial: true, studentMessage: "Detectamos un acuerdo por fuera." }),
    );
    expect(result).toEqual({ ok: true, decision: "denied" });
    const update = calls.find((c) => c.table === "estured_fee_payments" && c.op === "update")!;
    expect(update.payload).toMatchObject({ revocation_resolution: "denied" });
    expect(update.payload).not.toHaveProperty("status");
    expect(update.payload).not.toHaveProperty("refund_amount_ars");
    expect(createAuditLog).toHaveBeenCalledWith(admin, expect.objectContaining({ action: "estured_fee_revocation_denied" }));
    const bodies = createNotification.mock.calls.map((c) => (c as unknown as [unknown, { body: string }])[1].body);
    expect(bodies[0]).toContain("Detectamos un acuerdo por fuera.");
    expect(bodies.join(" ")).not.toContain("MOTIVO-INTERNO-SECRETO");
  });

  it("doble resolución o carrera entre admins: si el update no afecta filas, falla sin auditar ni avisar", async () => {
    const { admin } = fakeAdmin({ updateResult: { data: [], error: null } });
    const result = await resolveFeeRevocation(admin, params());
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/ya fue resuelta/i) });
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("una revocación ya resuelta se rechaza antes de escribir", async () => {
    const { admin, calls } = fakeAdmin({ fee: { ...FEE, revocation_resolution: "refunded", status: "refunded" } });
    const result = await resolveFeeRevocation(admin, params());
    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("valida en el servidor: motivo corto = error y no escribe nada", async () => {
    const { admin, calls } = fakeAdmin({});
    const result = await resolveFeeRevocation(admin, params({ internalReason: "corto" }));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/al menos 10/) });
    expect(calls.some((c) => c.op === "update")).toBe(false);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("migración 0049 sin aplicar: degrada con un mensaje claro (al leer o al escribir)", async () => {
    const onRead = fakeAdmin({ feeError: { code: "42703", message: "column estured_fee_payments.revocation_resolution does not exist" } });
    expect(await resolveFeeRevocation(onRead.admin, params())).toMatchObject({ ok: false, code: "migration_pending" });

    const onWrite = fakeAdmin({ updateResult: { data: null, error: { code: "PGRST204", message: "Could not find the 'revocation_resolution' column" } } });
    expect(await resolveFeeRevocation(onWrite.admin, params())).toMatchObject({ ok: false, code: "migration_pending" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("si falla la auditoría, la resolución queda y se alerta a los admins", async () => {
    createAuditLog.mockResolvedValue(false);
    const { admin } = fakeAdmin({});
    expect((await resolveFeeRevocation(admin, params())).ok).toBe(true);
    expect(alertAdminsOfAuditFailure).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ action: "estured_fee_refunded_after_revocation", entityId: "fee-1" }),
    );
  });

  it("cierra el caso de Soporte abierto SIN copiar el motivo interno a sus notas", async () => {
    const { admin, calls } = fakeAdmin({ cases: [{ id: "case-1", status: "opened" }, { id: "case-2", status: "closed_no_action" }] });
    await resolveFeeRevocation(admin, params({ studentMessage: "" }));
    const closes = calls.filter((c) => c.table === "support_cases" && c.op === "update");
    expect(closes).toHaveLength(1); // solo el abierto
    expect(closes[0].payload).toMatchObject({ status: "admin_action_taken", resolution_outcome: "estured_fee_refund" });
    expect(JSON.stringify(closes[0].payload)).not.toContain("MOTIVO-INTERNO-SECRETO");
  });

  it("reserva o fee inexistentes", async () => {
    expect(await resolveFeeRevocation(fakeAdmin({ reservation: null }).admin, params())).toMatchObject({ ok: false });
    expect(await resolveFeeRevocation(fakeAdmin({ fee: null }).admin, params())).toMatchObject({ ok: false });
  });

  it("el aviso al pagador solo sale si sigue con vínculo familiar activo; al estudiante siempre", async () => {
    const { admin } = fakeAdmin({ payerLinked: false });
    await resolveFeeRevocation(admin, params());
    const recipients = createNotification.mock.calls.map((c) => (c as unknown as [unknown, { userId: string }])[1].userId);
    expect(recipients).toEqual(["student-user"]);
  });

  it("la auditoría guarda solo los últimos 4 caracteres de la referencia, nunca completa", async () => {
    const { admin } = fakeAdmin({});
    await resolveFeeRevocation(admin, params({ refundReference: "OPERACION-123456789" }));
    const entry = (createAuditLog.mock.calls[0] as unknown as [unknown, { newValue: Record<string, unknown> }])[1];
    expect(entry.newValue.refund_reference_last4).toBe("6789");
    expect(JSON.stringify(entry.newValue)).not.toContain("OPERACION-123456789");
  });

  it("fee pagado en USD: sin el reconocimiento no reintegra; con él, sí (y la auditoría lo anota)", async () => {
    const fee = { ...FEE, payment_currency: "USD" };
    const rejected = fakeAdmin({ fee });
    expect(await resolveFeeRevocation(rejected.admin, params())).toMatchObject({ ok: false, error: expect.stringMatching(/USD/) });
    expect(rejected.calls.some((c) => c.op === "update")).toBe(false);

    const ok = fakeAdmin({ fee });
    expect(await resolveFeeRevocation(ok.admin, params({ acknowledgeUsdRefund: true }))).toEqual({ ok: true, decision: "refunded" });
  });
});
