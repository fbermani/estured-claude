import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => true) }));

import { openFeePaymentSupportCase } from "@/lib/support/openSupportCase";

const DESC = "Hice la transferencia pero todavía figura como pendiente.";

/** Cliente falso: cada tabla responde con su fila fija; registra los inserts. */
function fakeAdmin(rows: Record<string, unknown>) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = () => Promise.resolve({ data: rows[table] ?? null, error: null });
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows[`${table}:list`] ?? [], error: null });
      chain.insert = (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "case-1" }, error: null }) }) };
      };
      return chain;
    },
    rpc: async () => ({ data: true, error: null }),
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  };
  return { admin: client as unknown as SupabaseClient, inserts };
}

const RESERVATION = { id: "res-1", student_profile_id: "sp-1", estured_fee_payment_id: "fee-1", residences: { name: "Residencia Norte" } };
const base = { actorRole: "student", reservationId: "res-1", description: DESC, evidenceFiles: [] as File[] };

describe("openFeePaymentSupportCase", () => {
  it("abre un caso dirigido a EstuRed: sin residencia, sin recordatorio de deslinde, con la reserva como contexto", async () => {
    const { admin, inserts } = fakeAdmin({ reservations: RESERVATION, estured_fee_payments: { payer_user_id: "u1" } });
    const result = await openFeePaymentSupportCase(admin, { ...base, actorUserId: "u1" });
    expect(result).toEqual({ ok: true, supportCaseId: "case-1" });
    expect(inserts[0].payload).toMatchObject({
      topic: "estured_fee_payment",
      residence_id: null,
      terms_reminder_accepted_at: null,
      related_entity_type: "reservations",
      related_entity_id: "res-1",
    });
  });

  it("también lo puede abrir el estudiante beneficiario cuando el pagador es otra persona", async () => {
    const { admin, inserts } = fakeAdmin({
      reservations: RESERVATION,
      estured_fee_payments: { payer_user_id: "familiar" },
      student_profiles: { user_id: "u1" },
    });
    expect((await openFeePaymentSupportCase(admin, { ...base, actorUserId: "u1" })).ok).toBe(true);
    expect(inserts).toHaveLength(1);
  });

  it("rechaza a un tercero sin crear nada", async () => {
    const { admin, inserts } = fakeAdmin({
      reservations: RESERVATION,
      estured_fee_payments: { payer_user_id: "familiar" },
      student_profiles: { user_id: "otro-estudiante" },
    });
    const result = await openFeePaymentSupportCase(admin, { ...base, actorUserId: "intruso" });
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("exige un detalle de al menos 20 caracteres", async () => {
    const { admin, inserts } = fakeAdmin({ reservations: RESERVATION, estured_fee_payments: { payer_user_id: "u1" } });
    const result = await openFeePaymentSupportCase(admin, { ...base, actorUserId: "u1", description: "no pude" });
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("no duplica: si ya hay un caso abierto por esa reserva, avisa", async () => {
    const { admin, inserts } = fakeAdmin({
      reservations: RESERVATION,
      estured_fee_payments: { payer_user_id: "u1" },
      "support_cases:list": [{ id: "c0", status: "under_review" }],
    });
    const result = await openFeePaymentSupportCase(admin, { ...base, actorUserId: "u1" });
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});
