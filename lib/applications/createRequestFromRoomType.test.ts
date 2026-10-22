import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => true) }));
vi.mock("@/lib/exchange/rate", () => ({
  getCurrentExchangeRate: async () => ({ arsPerUsd: 1500, source: "test", rateDate: "2026-10-22", manuallyOverridden: false }),
}));
vi.mock("@/lib/applications/roomTypeQueue", () => ({
  determineInitialApplicationStatus: async () => ({ status: "submitted" }),
}));

import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";

/** Admin falso: devuelve la fila de `residences` configurada y captura el insert del snapshot. */
function fakeAdmin(residenceRow: Record<string, unknown>) {
  const inserts: Record<string, Record<string, unknown>[]> = {};
  const admin = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === "residences" ? residenceRow : null, error: null }),
        single: async () => ({ data: { id: `${table}-id` }, error: null }),
        insert: (row: Record<string, unknown>) => {
          (inserts[table] ??= []).push(row);
          return chain;
        },
        update: () => chain,
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      };
      return chain;
    },
  };
  return { admin: admin as unknown as SupabaseClient, inserts };
}

const params = {
  studentProfileId: "sp",
  residenceId: "res",
  roomTypeId: "rt",
  roomType: { monthly_price_usd: 320 },
  desiredStartDate: "2026-12-01",
  durationMonths: 6,
  academicObjective: "Empezar mi carrera",
  initiatedBy: "student" as const,
  contactTarget: "student" as const,
  familyLinkId: null,
  familyProposalId: null,
  createdByUserId: "u",
  actorRole: "student" as const,
};

describe("createApplicationFromRoomType: pago inicial en el snapshot (D7/H08)", () => {
  it("residencia con matrícula y modo primer mes: el snapshot guarda el primer mes, no la matrícula", async () => {
    const { admin, inserts } = fakeAdmin({
      minimum_stay_months: null,
      adjustment_policy: "quarterly",
      enrollment_fee_mode: "manual",
      enrollment_fee_usd: 150,
      enrollment_fee_frequency: "once",
      deposit_usd: null,
      empty_month_charge_percent: null,
      reservation_initial_payment_mode: "one_month",
      reservation_initial_payment_usd: null,
    });
    const result = await createApplicationFromRoomType(admin, params);
    expect("id" in result).toBe(true);
    const snapshot = inserts.application_snapshots[0];
    expect(snapshot.enrollment_fee_usd).toBe(150);
    expect(snapshot.reservation_payment_amount_usd).toBe(320);
    expect(snapshot.reservation_payment_amount_ars).toBe(320 * 1500);
  });

  it("monto fijo: el snapshot guarda el monto fijo en USD y su ARS exacto", async () => {
    const { admin, inserts } = fakeAdmin({
      adjustment_policy: "quarterly",
      enrollment_fee_mode: null,
      reservation_initial_payment_mode: "custom_usd",
      reservation_initial_payment_usd: "450.00",
    });
    await createApplicationFromRoomType(admin, params);
    const snapshot = inserts.application_snapshots[0];
    expect(snapshot.reservation_payment_amount_usd).toBe(450);
    expect(snapshot.reservation_payment_amount_ars).toBe(450 * 1500);
  });

  it("residencia sin el campo (fila previa a la migración): primer mes", async () => {
    const { admin, inserts } = fakeAdmin({ adjustment_policy: "quarterly", enrollment_fee_mode: null });
    await createApplicationFromRoomType(admin, params);
    expect(inserts.application_snapshots[0].reservation_payment_amount_usd).toBe(320);
  });
});
