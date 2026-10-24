import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ciclo 71 (DR8) — `confirmReservationAfterFeePaid` idempotente y seguro, con un cliente falso (sin base real: el test de
 * integración vive en confirmAfterFeePaid.test.ts y toca datos demo). Las dependencias laterales se mockean para contar efectos.
 */
const sideEffects = {
  receipts: 0,
  waitlist: 0,
  stayChange: 0,
  milestone: 0,
  promote: 0,
  audit: [] as string[],
};
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async (_admin: unknown, entry: { action: string }) => {
    sideEffects.audit.push(entry.action);
    return true;
  }),
  alertAdminsOfAuditFailure: vi.fn(async () => {}),
}));
vi.mock("@/lib/family/familyMilestones", () => ({
  notifyFamilyReservationMilestone: vi.fn(async () => {
    sideEffects.milestone += 1;
  }),
}));
vi.mock("@/lib/waitlist-entries/removeWaitlistEntriesOnConfirmedReservation", () => ({
  removeWaitlistEntriesOnConfirmedReservation: vi.fn(async () => {
    sideEffects.waitlist += 1;
  }),
}));
vi.mock("@/lib/applications/roomTypeQueue", () => ({
  promoteNextQueuedApplication: vi.fn(async () => {
    sideEffects.promote += 1;
  }),
}));
vi.mock("@/lib/stayChange/resolveStayChangeIntent", () => ({
  resolveStayChangeIntentOnReservation: vi.fn(async () => {
    sideEffects.stayChange += 1;
  }),
}));
vi.mock("@/lib/receipts/receiptNumber", () => ({
  insertReceiptWithRetry: vi.fn(async () => {
    sideEffects.receipts += 1;
    return { data: { id: "rc-new" }, error: null, verificationCode: "code-1", attempts: 1 };
  }),
}));

import { confirmReservationAfterFeePaid } from "@/lib/reservations/confirmAfterFeePaid";

type Db = {
  feeStatus: string;
  reservationStatus: string;
  bookingReceiptId?: string | null;
  residencePaymentStatus?: string;
  /** Filas que devuelve el UPDATE condicional de la reserva (0 = otro la confirmó primero). */
  confirmRows: number;
  siblings?: Array<{ id: string; status: string; room_type_id: string | null }>;
};

type Write = { table: string; patch: Record<string, unknown>; filters: Array<[string, unknown[]]> };

function fakeAdmin(db: Db) {
  const writes: Write[] = [];
  const rowFor = (table: string): Record<string, unknown> | null => {
    switch (table) {
      case "estured_fee_payments":
        return { id: "fee-1", status: db.feeStatus, reservation_id: "r1", payer_user_id: "u1", beneficiary_student_profile_id: "sp1", fee_amount_ars: 140500, fee_amount_usd: null, payment_currency: "ARS", payer_billing_name: "X", paid_at: "2026-10-24T15:00:00Z" };
      case "reservations":
        return {
          id: "r1",
          status: db.reservationStatus,
          booking_receipt_id: db.bookingReceiptId ?? null,
          application_request_id: "a1",
          student_profile_id: "sp1",
          residence_id: "res1",
          room_type_id: "rt1",
          snapshot_id: "s1",
          external_residence_payment_id: "p1",
          start_date: "2026-11-01",
        };
      case "external_residence_payments":
        return { status: db.residencePaymentStatus ?? "reported_received_by_residence", amount_reported_usd: 350, amount_reported_ars: 532000, reported_received_at: "2026-10-23T10:00:00Z" };
      case "profile_availability":
        return { id: "pa1", available_count: 2, status: "available_to_confirm" };
      default:
        return { id: `${table}-1`, first_name: "Lucía", last_initial: "F", name: "N" };
    }
  };
  const admin = {
    from(table: string) {
      const state = { op: "select", patch: {} as Record<string, unknown>, filters: [] as Array<[string, unknown[]]> };
      const record = (name: string) => (...args: unknown[]) => {
        state.filters.push([name, args]);
        return builder;
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (patch: Record<string, unknown>) => {
          state.op = "insert";
          writes.push({ table, patch, filters: [] });
          return builder;
        },
        update: (patch: Record<string, unknown>) => {
          state.op = "update";
          state.patch = patch;
          return builder;
        },
        eq: record("eq"),
        neq: record("neq"),
        in: record("in"),
        single: () => Promise.resolve({ data: rowFor(table), error: null }),
        maybeSingle: () => Promise.resolve({ data: rowFor(table), error: null }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          let result: { data: unknown; error: null };
          if (state.op === "update") {
            writes.push({ table, patch: state.patch, filters: state.filters });
            const conditional = state.filters.some(([n, a]) => n === "eq" && a[0] === "status" && a[1] === "pending_estured_fee");
            result = { data: table === "reservations" && conditional ? Array.from({ length: db.confirmRows }, () => ({ id: "r1" })) : [], error: null };
          } else if (state.op === "insert") {
            result = { data: null, error: null };
          } else {
            result = { data: table === "application_requests" ? (db.siblings ?? []) : [], error: null };
          }
          return Promise.resolve(result).then(res, rej);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { admin, writes };
}

const run = (admin: SupabaseClient) => confirmReservationAfterFeePaid(admin, { feePaymentId: "fee-1", actorUserId: "admin-1", actorRole: "admin" });
const noSideEffects = () => {
  expect(sideEffects.receipts).toBe(0);
  expect(sideEffects.waitlist).toBe(0);
  expect(sideEffects.stayChange).toBe(0);
  expect(sideEffects.milestone).toBe(0);
  expect(sideEffects.promote).toBe(0);
  expect(sideEffects.audit).toEqual([]);
};

beforeEach(() => {
  Object.assign(sideEffects, { receipts: 0, waitlist: 0, stayChange: 0, milestone: 0, promote: 0, audit: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("confirmReservationAfterFeePaid (cliente falso)", () => {
  it("fee paid + reserva pending_estured_fee: confirma con UPDATE condicional, emite UN comprobante y deja la factura pendiente", async () => {
    const { admin, writes } = fakeAdmin({ feeStatus: "paid", reservationStatus: "pending_estured_fee", confirmRows: 1 });
    const result = await run(admin);
    expect(result).toEqual({ ok: true, reservationId: "r1", receiptId: "rc-new", verificationCode: "code-1" });

    const confirmUpdate = writes.find((w) => w.table === "reservations" && w.patch.status === "confirmed");
    expect(confirmUpdate).toBeDefined();
    expect(confirmUpdate!.filters).toEqual(expect.arrayContaining([["eq", ["id", "r1"]], ["eq", ["status", "pending_estured_fee"]]]));
    expect(sideEffects.receipts).toBe(1);
    expect(writes.some((w) => w.table === "reservations" && w.patch.booking_receipt_id === "rc-new")).toBe(true);
    expect(writes.some((w) => w.table === "estured_fee_payments" && w.patch.fiscal_invoice_status === "pending_issue")).toBe(true);
    expect(writes.some((w) => w.table === "profile_availability" && w.patch.available_count === 1)).toBe(true);
    expect(sideEffects.audit).toEqual(["reservation_confirmed"]);
    expect(sideEffects.milestone).toBe(1);
  });

  it("un fee que no está paid no confirma nada (ni lee más ni escribe)", async () => {
    for (const feeStatus of ["pending_manual_payment", "pending_payment_method", "expired", "refunded"]) {
      const { admin, writes } = fakeAdmin({ feeStatus, reservationStatus: "pending_estured_fee", confirmRows: 1 });
      const result = await run(admin);
      expect(result, feeStatus).toMatchObject({ ok: false });
      expect(writes, feeStatus).toHaveLength(0);
    }
    noSideEffects();
  });

  it("reserva ya confirmada: devuelve ok SIN duplicar comprobante, factura, disponibilidad ni avisos (reintento idempotente)", async () => {
    const { admin, writes } = fakeAdmin({ feeStatus: "paid", reservationStatus: "confirmed", bookingReceiptId: "rc-existente", confirmRows: 1 });
    const result = await run(admin);
    expect(result).toMatchObject({ ok: true, reservationId: "r1", receiptId: "rc-existente" });
    expect(writes).toHaveLength(0);
    noSideEffects();
  });

  it("la reserva cambió de estado entre la lectura y el UPDATE (0 filas): no descuenta disponibilidad, no cierra hermanas ni emite comprobante", async () => {
    const { admin, writes } = fakeAdmin({
      feeStatus: "paid",
      reservationStatus: "pending_estured_fee",
      confirmRows: 0,
      siblings: [{ id: "sib1", status: "paused_due_to_other_active_request", room_type_id: "rt2" }],
    });
    const result = await run(admin);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/cambió de estado/);
    expect(writes.filter((w) => w.table !== "reservations")).toHaveLength(0);
    noSideEffects();
  });

  it("una reserva en otro estado (cancelada, vencida) no se confirma", async () => {
    for (const reservationStatus of ["cancelled", "expired", "pending_residence_payment"]) {
      const { admin, writes } = fakeAdmin({ feeStatus: "paid", reservationStatus, confirmRows: 1 });
      expect(await run(admin), reservationStatus).toMatchObject({ ok: false });
      expect(writes, reservationStatus).toHaveLength(0);
    }
  });

  it("sin el pago a la residencia confirmado no confirma", async () => {
    const { admin, writes } = fakeAdmin({ feeStatus: "paid", reservationStatus: "pending_estured_fee", residencePaymentStatus: "pending", confirmRows: 1 });
    expect(await run(admin)).toMatchObject({ ok: false });
    expect(writes).toHaveLength(0);
  });
});
