import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const auditEntries: Array<Record<string, unknown>> = [];
const confirmCalls: Array<Record<string, unknown>> = [];
const adminNotifications: Array<Record<string, unknown>> = [];
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
  alertAdminsOfAuditFailure: vi.fn(async () => {}),
  notifyAdmins: vi.fn(async (_admin: unknown, params: Record<string, unknown>) => {
    adminNotifications.push(params);
  }),
}));
vi.mock("@/lib/reservations/confirmAfterFeePaid", () => ({
  confirmReservationAfterFeePaid: vi.fn(async (_admin: unknown, params: Record<string, unknown>) => {
    confirmCalls.push(params);
    return confirmResult;
  }),
}));

import { recordManualFeePayment } from "@/lib/reservations/recordManualFeePayment";

const NOW = new Date("2026-10-24T15:00:00Z");
const MISSING_COLUMN = { code: "PGRST204", message: "Could not find the 'received_amount' column of 'estured_fee_payments' in the schema cache" };

type Db = {
  fee: Record<string, unknown> | null;
  reservationStatus: string;
  residencePaymentStatus: string;
  /** Filas que devuelve el UPDATE condicional (0 = alguien ya lo procesó). */
  updatedRows: number;
  /** Error del primer UPDATE (migración 0050 sin aplicar). */
  firstUpdateError?: { code: string; message: string };
  /** Errores de lectura por tabla. */
  readErrors?: Partial<Record<"estured_fee_payments" | "reservations" | "external_residence_payments", { code: string; message: string }>>;
};

type Update = { patch: Record<string, unknown>; filters: Array<[string, unknown[]]> };

function fakeAdmin(db: Db) {
  const updates: Update[] = [];
  let updateCalls = 0;
  const admin = {
    from(table: string) {
      const state = { op: "select", patch: {} as Record<string, unknown>, filters: [] as Array<[string, unknown[]]> };
      const record = (name: string) => (...args: unknown[]) => {
        state.filters.push([name, args]);
        return builder;
      };
      const resolveWrite = () => {
        updateCalls += 1;
        updates.push({ patch: state.patch, filters: state.filters });
        if (updateCalls === 1 && db.firstUpdateError) return { data: null, error: db.firstUpdateError };
        return { data: Array.from({ length: db.updatedRows }, () => ({ id: "fee-1" })), error: null };
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (patch: Record<string, unknown>) => {
          state.op = "update";
          state.patch = patch;
          return builder;
        },
        eq: record("eq"),
        in: record("in"),
        gt: record("gt"),
        not: record("not"),
        is: record("is"),
        or: record("or"),
        maybeSingle: () => {
          const readError = db.readErrors?.[table as keyof NonNullable<Db["readErrors"]>];
          if (readError) return Promise.resolve({ data: null, error: readError });
          if (table === "estured_fee_payments") return Promise.resolve({ data: db.fee, error: null });
          if (table === "reservations") {
            return Promise.resolve({ data: { id: "r1", status: db.reservationStatus, external_residence_payment_id: "p1" }, error: null });
          }
          if (table === "external_residence_payments") return Promise.resolve({ data: { status: db.residencePaymentStatus }, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(state.op === "update" ? resolveWrite() : { data: null, error: null }).then(res, rej),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { admin, updates };
}

const baseFee = {
  id: "fee-1",
  status: "pending_manual_payment",
  expires_at: "2026-10-24T20:00:00Z",
  manual_payment_file_id: "file-1",
  fee_amount_ars: 140500,
  fee_amount_usd: null,
  fee_base_usd: 1900,
  fee_base_ars: 2812000,
  reservation_id: "r1",
  renewal_offer_id: null,
};

const baseDb = (over: Partial<Db> = {}): Db => ({
  fee: baseFee,
  reservationStatus: "pending_estured_fee",
  residencePaymentStatus: "reported_received_by_residence",
  updatedRows: 1,
  ...over,
});

const params = (over: Record<string, unknown> = {}) => ({
  feePaymentId: "fee-1",
  reason: "Comprobante verificado.",
  paymentCurrency: "ARS",
  receivedAmount: "140500",
  providerReference: null as string | null,
  intent: "confirm",
  confirmWithoutReceipt: false,
  verified: true,
  acceptAmountDifference: false,
  seenReceiptFileId: "file-1" as string | null,
  actorUserId: "admin-1",
  actorRole: "admin" as const,
  now: NOW,
  ...over,
});

beforeEach(() => {
  auditEntries.length = 0;
  confirmCalls.length = 0;
  adminNotifications.length = 0;
  confirmResult = { ok: true, reservationId: "r1", receiptId: "rc1", verificationCode: "X" };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordManualFeePayment con un cliente falso", () => {
  it("con comprobante y monto exacto: update condicional, auditoría y confirmación de reserva", async () => {
    const { admin, updates } = fakeAdmin(baseDb());
    expect(await recordManualFeePayment(admin, params())).toEqual({ ok: true });

    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({
      status: "paid",
      payment_provider: "manual",
      payment_currency: "ARS",
      received_amount: 140500,
      confirmed_without_receipt: false,
      validated_by_user_id: "admin-1",
    });
    const filterNames = updates[0].filters.map(([name]) => name);
    expect(filterNames).toEqual(expect.arrayContaining(["eq", "or"]));
    // La condición del UPDATE coincide con lo evaluado: mismo estado leído, mismo comprobante por id y plazo vigente o sin plazo.
    const eqs = updates[0].filters.filter(([n]) => n === "eq").map(([, a]) => a);
    expect(eqs).toEqual(expect.arrayContaining([["id", "fee-1"], ["status", "pending_manual_payment"], ["manual_payment_file_id", "file-1"]]));
    expect(updates[0].filters.find(([n]) => n === "or")?.[1]).toEqual([`expires_at.is.null,expires_at.gt.${NOW.toISOString()}`]);
    expect(confirmCalls).toHaveLength(1);

    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]).toMatchObject({ action: "estured_fee_marked_paid_manually", actorUserId: "admin-1", entityId: "fee-1" });
    expect(auditEntries[0].reasonCode).toBeUndefined();
    expect(auditEntries[0].newValue).toMatchObject({ expected_amount: 140500, received_amount: 140500, confirmed_without_receipt: false, had_receipt: true });
  });

  it("la auditoría no vuelca datos de facturación ni la referencia del pago", async () => {
    const { admin } = fakeAdmin(baseDb());
    await recordManualFeePayment(admin, params({ providerReference: "OP-123456789" }));
    const dump = JSON.stringify(auditEntries[0]);
    expect(dump).not.toMatch(/cuit|billing|iva|OP-123456789/i);
    expect(auditEntries[0].newValue).toMatchObject({ provider_reference_set: true });
  });

  it("sin comprobante y sin override: rechaza y no escribe nada", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ fee: { ...baseFee, status: "pending_payment_method", manual_payment_file_id: null } }));
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    expect(updates).toHaveLength(0);
    expect(auditEntries).toHaveLength(0);
    expect(confirmCalls).toHaveLength(0);
  });

  it("override sin comprobante: queda marcado en la fila y en la auditoría", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ fee: { ...baseFee, status: "pending_payment_method", manual_payment_file_id: null } }));
    const result = await recordManualFeePayment(
      admin,
      params({ intent: "confirm_without_receipt", confirmWithoutReceipt: true, reason: "Soporte vio el movimiento en el banco." }),
    );
    expect(result).toEqual({ ok: true });
    expect(updates[0].patch).toMatchObject({ confirmed_without_receipt: true });
    // Sin comprobante el update exige que siga sin comprobante (por si lo suben en el medio) y en el mismo estado que se leyó.
    expect(updates[0].filters.some(([n, a]) => n === "is" && a[0] === "manual_payment_file_id")).toBe(true);
    expect(updates[0].filters.some(([n, a]) => n === "eq" && a[0] === "status" && a[1] === "pending_payment_method")).toBe(true);
    expect(auditEntries[0]).toMatchObject({ reasonCode: "confirmed_without_receipt" });
    expect(auditEntries[0].newValue).toMatchObject({ confirmed_without_receipt: true, had_receipt: false });
  });

  it("diferencia > 1 %: exige el checkbox y el motivo largo; con ambos sigue y la marca", async () => {
    const noCheckbox = fakeAdmin(baseDb());
    const rejected = await recordManualFeePayment(noCheckbox.admin, params({ receivedAmount: "130000", reason: "Pagó de menos, completa la semana próxima." }));
    expect(rejected).toMatchObject({ ok: false });
    if (!rejected.ok) expect(rejected.error).toMatch(/aceptás la diferencia/);
    expect(noCheckbox.updates).toHaveLength(0);

    const short = fakeAdmin(baseDb());
    expect(await recordManualFeePayment(short.admin, params({ receivedAmount: "130000", reason: "ok ok", acceptAmountDifference: true }))).toMatchObject({ ok: false });
    expect(short.updates).toHaveLength(0);

    const long = fakeAdmin(baseDb());
    const result = await recordManualFeePayment(
      long.admin,
      params({ receivedAmount: "130000", reason: "Pagó de menos, completa la semana próxima.", acceptAmountDifference: true }),
    );
    expect(result).toEqual({ ok: true });
    expect(auditEntries[0]).toMatchObject({ reasonCode: "amount_difference" });
    expect(auditEntries[0].newValue).toMatchObject({
      expected_amount: 140500,
      received_amount: 130000,
      amount_within_tolerance: false,
      amount_difference_accepted: true,
      below_floor: false,
      difference: -10500,
    });
  });

  it("piso del 90 %: un admin no puede; un superadmin sí, y queda auditado como tal", async () => {
    const asAdmin = fakeAdmin(baseDb());
    const blocked = await recordManualFeePayment(
      asAdmin.admin,
      params({ receivedAmount: "100000", reason: "Pagó de menos, completa la semana próxima.", acceptAmountDifference: true }),
    );
    expect(blocked).toMatchObject({ ok: false });
    if (!blocked.ok) expect(blocked.error).toMatch(/superadmin/);
    expect(asAdmin.updates).toHaveLength(0);
    expect(confirmCalls).toHaveLength(0);

    const asSuper = fakeAdmin(baseDb());
    const result = await recordManualFeePayment(
      asSuper.admin,
      params({ receivedAmount: "100000", reason: "Pagó de menos, completa la semana próxima.", acceptAmountDifference: true, actorRole: "superadmin" }),
    );
    expect(result).toEqual({ ok: true });
    expect(auditEntries[0]).toMatchObject({ actorRole: "superadmin", reasonCode: "amount_difference" });
    expect(auditEntries[0].newValue).toMatchObject({ below_floor: true, amount_difference_accepted: true });
  });

  it("override sin comprobante + diferencia: el reason_code conserva las dos cosas", async () => {
    const { admin } = fakeAdmin(baseDb({ fee: { ...baseFee, status: "pending_payment_method", manual_payment_file_id: null } }));
    const result = await recordManualFeePayment(
      admin,
      params({
        intent: "confirm_without_receipt",
        confirmWithoutReceipt: true,
        receivedAmount: "130000",
        acceptAmountDifference: true,
        reason: "Soporte vio el movimiento en el banco, pagó de menos.",
        seenReceiptFileId: null,
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(auditEntries[0]).toMatchObject({ reasonCode: "confirmed_without_receipt,amount_difference" });
    expect(auditEntries[0].newValue).toMatchObject({ confirmed_without_receipt: true, amount_difference_accepted: true });
  });

  it("diferencia chica de redondeo no frena el pago (y se audita igual)", async () => {
    const { admin } = fakeAdmin(baseDb());
    expect(await recordManualFeePayment(admin, params({ receivedAmount: "140000" }))).toEqual({ ok: true });
    expect(auditEntries[0].newValue).toMatchObject({ amount_exact: false, amount_within_tolerance: true, difference: -500 });
  });

  it("plazo vencido: rechaza sin escribir", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ fee: { ...baseFee, expires_at: "2026-10-24T14:00:00Z" } }));
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/Reabrilo/);
    expect(updates).toHaveLength(0);
  });

  it("doble confirmación: si el update no afecta filas, no audita ni confirma la reserva", async () => {
    const { admin } = fakeAdmin(baseDb({ updatedRows: 0 }));
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/ya fue procesado/);
    expect(auditEntries).toHaveLength(0);
    expect(confirmCalls).toHaveLength(0);
  });

  it("rechaza si el pago ya no está pendiente o la reserva ya no espera el fee", async () => {
    const paid = fakeAdmin(baseDb({ fee: { ...baseFee, status: "paid" } }));
    expect(await recordManualFeePayment(paid.admin, params())).toMatchObject({ ok: false });
    const confirmed = fakeAdmin(baseDb({ reservationStatus: "confirmed" }));
    expect(await recordManualFeePayment(confirmed.admin, params())).toMatchObject({ ok: false });
    expect(paid.updates.length + confirmed.updates.length).toBe(0);
  });

  it("un fee sin plazo (expires_at null) no se traba: el UPDATE acepta plazo nulo", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ fee: { ...baseFee, expires_at: null } }));
    expect(await recordManualFeePayment(admin, params())).toEqual({ ok: true });
    expect(updates[0].filters.find(([n]) => n === "or")?.[1]?.[0]).toMatch(/^expires_at\.is\.null,/);
  });

  it("comprobante cargado pero el pago sigue en pending_payment_method: mensaje propio, sin escribir", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ fee: { ...baseFee, status: "pending_payment_method" } }));
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/todavía no pasó a revisión manual/);
    expect(updates).toHaveLength(0);
  });

  it("el comprobante cambió mientras se revisaba (o el form no mandó el visto): rechaza sin escribir", async () => {
    const changed = fakeAdmin(baseDb());
    const result = await recordManualFeePayment(changed.admin, params({ seenReceiptFileId: "file-viejo" }));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/comprobante cambió/);
    const missing = fakeAdmin(baseDb());
    expect(await recordManualFeePayment(missing.admin, params({ seenReceiptFileId: null }))).toMatchObject({ ok: false });
    expect(changed.updates.length + missing.updates.length).toBe(0);
  });

  it("errores de lectura (fee, reserva, pago a la residencia): mensaje accionable y nada se escribe", async () => {
    for (const table of ["estured_fee_payments", "reservations", "external_residence_payments"] as const) {
      const { admin, updates } = fakeAdmin(baseDb({ readErrors: { [table]: { code: "XX000", message: "boom" } } }));
      const result = await recordManualFeePayment(admin, params());
      expect(result, table).toEqual({ ok: false, error: "No pudimos leer el pago. Probá de nuevo." });
      expect(updates).toHaveLength(0);
    }
    expect(confirmCalls).toHaveLength(0);
  });

  it("fee paid pero la confirmación de la reserva falla: audita, avisa a los admins y orienta a reintentar", async () => {
    confirmResult = { ok: false, error: "No pudimos confirmar la reserva." };
    const { admin } = fakeAdmin(baseDb());
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/Reintentar confirmación/);
    expect(auditEntries.map((e) => e.action)).toEqual(["estured_fee_marked_paid_manually", "reservation_confirmation_failed_after_fee_paid"]);
    expect(auditEntries[1]).toMatchObject({ entityType: "estured_fee_payments", entityId: "fee-1" });
    expect(auditEntries[1].newValue).toMatchObject({ reservation_id: "r1", error: "No pudimos confirmar la reserva." });
    expect(adminNotifications).toHaveLength(1);
    expect(adminNotifications[0]).toMatchObject({ entityType: "estured_fee_payments", entityId: "fee-1" });
  });

  it("sin la migración 0050: repite el update sin las columnas nuevas y deja el detalle en la auditoría", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ firstUpdateError: MISSING_COLUMN }));
    expect(await recordManualFeePayment(admin, params())).toEqual({ ok: true });
    expect(updates).toHaveLength(2);
    expect(updates[0].patch).toHaveProperty("received_amount");
    expect(updates[1].patch).not.toHaveProperty("received_amount");
    expect(updates[1].patch).not.toHaveProperty("confirmed_without_receipt");
    expect(updates[1].patch).toMatchObject({ status: "paid" });
    expect(auditEntries[0].newValue).toMatchObject({ received_amount: 140500, stored_on_payment_row: false });
    expect(confirmCalls).toHaveLength(1);
  });

  it("un error de base distinto no se confunde con la migración pendiente", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ firstUpdateError: { code: "XX000", message: "boom" } }));
    const result = await recordManualFeePayment(admin, params());
    expect(result).toMatchObject({ ok: false });
    expect(updates).toHaveLength(1);
    expect(confirmCalls).toHaveLength(0);
  });

  it("una columna faltante AJENA a la 0050 tampoco dispara el reintento sin columnas", async () => {
    const { admin, updates } = fakeAdmin(baseDb({ firstUpdateError: { code: "42703", message: 'column "otra_cosa" does not exist' } }));
    expect(await recordManualFeePayment(admin, params())).toMatchObject({ ok: false });
    expect(updates).toHaveLength(1);
    expect(confirmCalls).toHaveLength(0);
  });

  it("no toca la base si la entrada es inválida (sin 'Verifiqué el pago')", async () => {
    const result = await recordManualFeePayment({} as SupabaseClient, params({ verified: false }));
    expect(result).toMatchObject({ ok: false });
  });

  it("un pago de renovación no se valida por esta vía", async () => {
    const { admin } = fakeAdmin(baseDb({ fee: { ...baseFee, reservation_id: null, renewal_offer_id: "ro-1" } }));
    expect(await recordManualFeePayment(admin, params())).toMatchObject({ ok: false });
  });
});
