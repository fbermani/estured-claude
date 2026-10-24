import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveRevocationState, loadRevocationRecords, summarizePendingRevocations, type RevocationRecord } from "@/lib/revocations/loadRevocations";

const record = (over: Partial<RevocationRecord>): RevocationRecord => ({
  reservationId: "r",
  feeId: "f",
  revokedAt: "2026-10-20T12:00:00.000Z",
  paidAt: "2026-10-19T12:00:00.000Z",
  studentName: null,
  requestedBy: null,
  studentReason: null,
  residenceName: null,
  residenceArea: null,
  feeStatus: "paid",
  paymentCurrency: "ARS",
  feeAmountArs: 67000,
  feeAmountUsd: null,
  window: null,
  state: "pending",
  supportCaseId: null,
  resolvedAt: null,
  internalReason: null,
  studentMessage: null,
  refundedAt: null,
  refundAmountArs: null,
  refundMethod: null,
  refundReference: null,
  ...over,
});

describe("deriveRevocationState", () => {
  it("sin la 0049 todo fee pagado es pendiente; con resolución, el estado sale de ella", () => {
    expect(deriveRevocationState({ status: "paid" })).toBe("pending");
    expect(deriveRevocationState({ status: "paid", revocation_resolution: null })).toBe("pending");
    expect(deriveRevocationState({ status: "refunded", revocation_resolution: "refunded" })).toBe("refunded");
    expect(deriveRevocationState({ status: "refunded" })).toBe("refunded");
    expect(deriveRevocationState({ status: "paid", revocation_resolution: "denied" })).toBe("denied");
  });

  it("un fee que no está paid ni refunded (p. ej. chargeback) no es pendiente: es 'other'", () => {
    expect(deriveRevocationState({ status: "chargeback" })).toBe("other");
    expect(deriveRevocationState({ status: "chargeback", revocation_resolution: null })).toBe("other");
    expect(deriveRevocationState({ status: "chargeback", revocation_resolution: "denied" })).toBe("denied");
  });
});

describe("loadRevocationRecords (degradación sin la migración 0049)", () => {
  it("si falta la 0049 relee sin las columnas nuevas y avisa con migrationApplied = false", async () => {
    const selects: string[] = [];
    const feeRow = { id: "f", status: "paid", paid_at: "2026-10-19T12:00:00.000Z", payment_currency: "ARS", fee_amount_ars: 100, fee_amount_usd: null, fee_base_usd: null, fee_rate_percent: null, refunded_at: null };
    const client = {
      from(table: string) {
        const chain: Record<string, unknown> = {};
        chain.select = (cols: string) => {
          if (table === "reservations") selects.push(cols);
          return chain;
        };
        chain.eq = () => chain;
        chain.in = () => chain;
        chain.order = () =>
          Promise.resolve(
            selects[selects.length - 1].includes("revocation_resolution")
              ? { data: null, error: { code: "42703", message: "column estured_fee_payments.revocation_resolution does not exist" } }
              : { data: [{ id: "r1", cancelled_at: "2026-10-20T12:00:00.000Z", residences: null, student_profiles: null, estured_fee_payments: feeRow }], error: null },
          );
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
        return chain;
      },
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const load = await loadRevocationRecords(client as unknown as SupabaseClient);
    spy.mockRestore();
    expect(selects).toHaveLength(2);
    expect(load.migrationApplied).toBe(false);
    expect(load.loadFailed).toBe(false);
    expect(load.records).toHaveLength(1);
    expect(load.records[0].state).toBe("pending");
  });
});

describe("summarizePendingRevocations (contador del dashboard)", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");

  it("cuenta solo pendientes y da la antigüedad de la más vieja", () => {
    const summary = summarizePendingRevocations(
      [
        record({ reservationId: "a", revokedAt: "2026-10-20T12:00:00.000Z" }),
        record({ reservationId: "b", revokedAt: "2026-10-23T12:00:00.000Z" }),
        record({ reservationId: "c", state: "refunded", revokedAt: "2026-09-01T12:00:00.000Z" }),
        record({ reservationId: "d", state: "denied", revokedAt: "2026-09-01T12:00:00.000Z" }),
      ],
      now,
    );
    expect(summary).toEqual({ count: 2, oldestAgeDays: 4 });
  });

  it("sin pendientes no hay antigüedad", () => {
    expect(summarizePendingRevocations([], now)).toEqual({ count: 0, oldestAgeDays: null });
    expect(summarizePendingRevocations([record({ state: "refunded" })], now)).toEqual({ count: 0, oldestAgeDays: null });
    expect(summarizePendingRevocations([record({ state: "other", feeStatus: "chargeback" })], now)).toEqual({ count: 0, oldestAgeDays: null });
  });
});
