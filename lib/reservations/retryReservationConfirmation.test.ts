import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const auditEntries: Array<Record<string, unknown>> = [];
const confirmCalls: Array<Record<string, unknown>> = [];
let confirmResult: { ok: true; reservationId: string; receiptId: string; verificationCode: string } | { ok: false; error: string } = {
  ok: true,
  reservationId: "r1",
  receiptId: "rc1",
  verificationCode: "X",
};
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async (_admin: unknown, entry: Record<string, unknown>) => {
    auditEntries.push(entry);
    return true;
  }),
}));
vi.mock("@/lib/reservations/confirmAfterFeePaid", () => ({
  confirmReservationAfterFeePaid: vi.fn(async (_admin: unknown, params: Record<string, unknown>) => {
    confirmCalls.push(params);
    return confirmResult;
  }),
}));

import { retryReservationConfirmation } from "@/lib/reservations/retryReservationConfirmation";

type Db = {
  fee: Record<string, unknown> | null;
  reservation: Record<string, unknown> | null;
  readErrors?: Partial<Record<"estured_fee_payments" | "reservations", { code: string; message: string }>>;
};

function fakeAdmin(db: Db) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => {
          const readError = db.readErrors?.[table as "estured_fee_payments" | "reservations"];
          if (readError) return Promise.resolve({ data: null, error: readError });
          return Promise.resolve({ data: table === "estured_fee_payments" ? db.fee : db.reservation, error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const paidFee = { id: "fee-1", status: "paid", reservation_id: "r1", renewal_offer_id: null };
const pendingReservation = { id: "r1", status: "pending_estured_fee" };
const params = { feePaymentId: "fee-1", actorUserId: "admin-1", actorRole: "admin" as const };

beforeEach(() => {
  auditEntries.length = 0;
  confirmCalls.length = 0;
  confirmResult = { ok: true, reservationId: "r1", receiptId: "rc1", verificationCode: "X" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("retryReservationConfirmation", () => {
  it("fee paid + reserva pending_estured_fee: reintenta, confirma y audita el reintento", async () => {
    const result = await retryReservationConfirmation(fakeAdmin({ fee: paidFee, reservation: pendingReservation }), params);
    expect(result).toEqual({ ok: true });
    expect(confirmCalls).toEqual([{ feePaymentId: "fee-1", actorUserId: "admin-1", actorRole: "admin" }]);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({ action: "reservation_confirmation_retried", entityType: "estured_fee_payments", entityId: "fee-1", actorUserId: "admin-1" });
    expect(auditEntries[0].newValue).toMatchObject({ reservation_id: "r1", succeeded: true });
  });

  it("si la confirmación vuelve a fallar: devuelve el error y también lo audita", async () => {
    confirmResult = { ok: false, error: "No pudimos confirmar la reserva." };
    const result = await retryReservationConfirmation(fakeAdmin({ fee: paidFee, reservation: pendingReservation }), params);
    expect(result).toMatchObject({ ok: false });
    expect(auditEntries[0].newValue).toMatchObject({ succeeded: false, error: "No pudimos confirmar la reserva." });
  });

  it("reserva ya confirmada: no hay nada que reintentar (no llama a la confirmación)", async () => {
    const result = await retryReservationConfirmation(fakeAdmin({ fee: paidFee, reservation: { id: "r1", status: "confirmed" } }), params);
    expect(result).toMatchObject({ ok: false });
    expect(confirmCalls).toHaveLength(0);
    expect(auditEntries).toHaveLength(0);
  });

  it("fee que no está paid, de renovación o inexistente: rechaza sin llamar a la confirmación", async () => {
    for (const fee of [{ ...paidFee, status: "pending_manual_payment" }, { ...paidFee, reservation_id: null, renewal_offer_id: "ro-1" }, null]) {
      expect(await retryReservationConfirmation(fakeAdmin({ fee, reservation: pendingReservation }), params)).toMatchObject({ ok: false });
    }
    expect(confirmCalls).toHaveLength(0);
    expect(auditEntries).toHaveLength(0);
  });

  it("errores de lectura: mensaje accionable", async () => {
    for (const table of ["estured_fee_payments", "reservations"] as const) {
      const result = await retryReservationConfirmation(
        fakeAdmin({ fee: paidFee, reservation: pendingReservation, readErrors: { [table]: { code: "XX000", message: "boom" } } }),
        params,
      );
      expect(result, table).toMatchObject({ ok: false, error: expect.stringMatching(/Probá de nuevo/) });
    }
    expect(confirmCalls).toHaveLength(0);
  });
});
