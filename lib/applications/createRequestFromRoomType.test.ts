import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso } from "@/lib/applications/reservationMoney";

vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => true) }));
vi.mock("@/lib/exchange/rate", () => ({
  getCurrentExchangeRate: async () => ({ arsPerUsd: 1500, source: "test", rateDate: "2026-10-22", manuallyOverridden: false }),
}));
vi.mock("@/lib/applications/roomTypeQueue", () => ({
  determineInitialApplicationStatus: async () => ({ status: "submitted" }),
}));

import { createApplicationFromRoomType } from "@/lib/applications/createRequestFromRoomType";

/** Admin falso: devuelve la fila de `residences` configurada y captura el insert del snapshot. */
function fakeAdmin(residenceRow: Record<string, unknown>, promotions: Record<string, unknown>[] = [], promotionsError: { code: string; message: string } | null = null, tables: Record<string, unknown[]> = {}) {
  const inserts: Record<string, Record<string, unknown>[]> = {};
  const admin = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        neq: () => chain,
        maybeSingle: async () => ({ data: table === "residences" ? residenceRow : null, error: null }),
        single: async () => ({ data: { id: `${table}-id` }, error: null }),
        insert: (row: Record<string, unknown>) => {
          (inserts[table] ??= []).push(row);
          return chain;
        },
        update: () => chain,
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: table === "residence_promotions" ? promotions : (tables[table] ?? null), error: table === "residence_promotions" ? promotionsError : null }),
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

describe("createApplicationFromRoomType: dinero DR18 tanda 3", () => {
  const iso = (offsetDays: number) =>
    new Date(Date.parse(`${todayIso()}T00:00:00Z`) + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const promo = { id: "promo-1", label: "Invierno", discount_percent: 25, room_type_id: null, starts_on: iso(-1), ends_on: iso(30), is_active: true };

  it("matrícula al 50% + pago inicial solo matrícula: el snapshot y el fee usan la matrícula neta", async () => {
    const { admin, inserts } = fakeAdmin({
      adjustment_policy: "quarterly",
      enrollment_fee_mode: "manual",
      enrollment_fee_usd: 200,
      enrollment_discount_percent: 50,
      reservation_initial_payment_mode: "enrollment_only",
    });
    await createApplicationFromRoomType(admin, params);
    const s = inserts.application_snapshots[0];
    expect(s.enrollment_fee_usd).toBe(100);
    expect(s.enrollment_fee_list_usd).toBe(200);
    expect(s.enrollment_fee_discount_percent).toBe(50);
    expect(s.reservation_payment_amount_usd).toBe(100);
    expect(s.fee_base_usd).toBe(320 * 6 + 100);
  });

  it("promoción vigente: monthly_price_usd es el precio final y la lista queda aparte; el fee sale del monto final", async () => {
    const { admin, inserts } = fakeAdmin({ adjustment_policy: "quarterly", enrollment_fee_mode: null }, [promo]);
    await createApplicationFromRoomType(admin, params);
    const s = inserts.application_snapshots[0];
    expect(s.monthly_price_usd).toBe(240);
    expect(s.list_monthly_price_usd).toBe(320);
    expect(s.promotion_percent).toBe(25);
    expect(s.promotion_id).toBe("promo-1");
    expect(s.reservation_payment_amount_usd).toBe(240);
    expect(s.fee_base_usd).toBe(240 * 6);
  });

  it("si falla la lectura de promociones (no es migración faltante) devuelve error y no congela a precio de lista", async () => {
    const { admin, inserts } = fakeAdmin({ adjustment_policy: "quarterly", enrollment_fee_mode: null }, [], { code: "XX000", message: "boom" });
    const result = await createApplicationFromRoomType(admin, params);
    expect("error" in result).toBe(true);
    expect(inserts.application_snapshots).toBeUndefined();
  });

  it("promoción vencida o inactiva no aplica y no agrega columnas nuevas al snapshot", async () => {
    const { admin, inserts } = fakeAdmin({ adjustment_policy: "quarterly", enrollment_fee_mode: null }, [
      { ...promo, ends_on: iso(-2) },
      { ...promo, id: "p2", is_active: false },
    ]);
    await createApplicationFromRoomType(admin, params);
    const s = inserts.application_snapshots[0];
    expect(s.monthly_price_usd).toBe(320);
    expect("list_monthly_price_usd" in s).toBe(false);
    expect("enrollment_fee_list_usd" in s).toBe(false);
  });

  it("sin la migración 0060 (tabla inexistente) sigue a precio de lista", async () => {
    const { admin, inserts } = fakeAdmin({ adjustment_policy: "quarterly", enrollment_fee_mode: null }, [], { code: "42P01", message: "relation does not exist" });
    await createApplicationFromRoomType(admin, params);
    expect(inserts.application_snapshots[0].monthly_price_usd).toBe(320);
  });

  it("depósito en meses se resuelve sobre la tarifa de lista y no entra al fee; mes vacío sin ocupación confiable: a confirmar, no suma", async () => {
    const { admin, inserts } = fakeAdmin(
      { adjustment_policy: "quarterly", enrollment_fee_mode: null, deposit_mode: "two_months", empty_month_charge_percent: 50 },
      [promo],
    );
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: iso(100) });
    const s = inserts.application_snapshots[0];
    expect(s.deposit_usd).toBe(640);
    expect(s.fee_base_usd).toBe(240 * 6);
  });

  // Mes vacío confirmado (correcciones del dueño): solo con ocupación real (Premium) y reserva diferida.
  const emptyMonthResidence = {
    adjustment_policy: "quarterly",
    enrollment_fee_mode: null,
    empty_month_charge_percent: 50,
    has_operational_management_access: true,
  };
  const monthKeyAhead = (n: number) => {
    const [y, m] = todayIso().split("-").map(Number);
    const idx = m - 1 + n;
    return `${y + Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`;
  };
  const baseTables = (stayEnd: string | null) => ({
    room_types: [{ id: "rt", capacity_per_room: 1 }],
    rooms: [{ room_type_id: "rt" }],
    resident_stays: [{ room_type_id: "rt", start_date: "2020-01-01", end_date: stayEnd, reservation_id: null }],
    reservations: [],
  });

  it("ingreso diferido con la plaza libre en los meses intermedios: se cobra el mes vacío y entra a la base del fee", async () => {
    // Un solo lugar, ocupado hasta antes del mes siguiente: los 2 meses completos entre hoy y el ingreso (a 3 meses) están libres.
    const { admin, inserts } = fakeAdmin(emptyMonthResidence, [], null, baseTables("2020-12-31"));
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(3) });
    const s = inserts.application_snapshots[0];
    expect(s.empty_months_count).toBe(2);
    expect(s.empty_months_charge_usd).toBe(2 * 320 * 0.5);
    expect(s.fee_base_usd).toBe(320 * 6 + 320);
  });

  it("la plaza ocupada en los meses intermedios: no se cobra", async () => {
    const { admin, inserts } = fakeAdmin(emptyMonthResidence, [], null, baseTables(null));
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(3) });
    const s = inserts.application_snapshots[0];
    expect("empty_months_charge_usd" in s).toBe(false);
    expect(s.fee_base_usd).toBe(320 * 6);
  });

  it("reserva no diferida: no hay mes vacío aunque la plaza esté libre", async () => {
    const { admin, inserts } = fakeAdmin(emptyMonthResidence, [], null, baseTables("2020-12-31"));
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(1) });
    expect("empty_months_charge_usd" in inserts.application_snapshots[0]).toBe(false);
  });

  it("sin Gestión Operativa (sin ocupación confiable): no se cobra", async () => {
    const { admin, inserts } = fakeAdmin({ ...emptyMonthResidence, has_operational_management_access: false }, [], null, baseTables("2020-12-31"));
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(3) });
    expect("empty_months_charge_usd" in inserts.application_snapshots[0]).toBe(false);
  });

  it("una reserva disputada ocupa plaza: el mes no se cobra (el filtro usa los estados vigentes)", async () => {
    const { LIVE_RESERVATION_STATUSES } = await import("@/lib/reservations/reservationStatus");
    expect(LIVE_RESERVATION_STATUSES).toContain("disputed");
    expect(LIVE_RESERVATION_STATUSES).toContain("estured_fee_failed");
    const tables = { ...baseTables("2020-12-31"), reservations: [{ id: "r1", room_type_id: "rt", start_date: "2020-01-01", initial_duration_months: 120 }] };
    const { admin, inserts } = fakeAdmin(emptyMonthResidence, [], null, tables);
    await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(3) });
    expect("empty_months_charge_usd" in inserts.application_snapshots[0]).toBe(false);
  });

  it("reserva sin start_date o sin duración: no se asume libre, no se cobra", async () => {
    for (const bad of [
      { id: "r1", room_type_id: "rt", start_date: null, initial_duration_months: 6 },
      { id: "r2", room_type_id: "rt", start_date: "2026-12-01", initial_duration_months: null },
    ]) {
      const { admin, inserts } = fakeAdmin(emptyMonthResidence, [], null, { ...baseTables("2020-12-31"), reservations: [bad] });
      await createApplicationFromRoomType(admin, { ...params, desiredStartDate: monthKeyAhead(3) });
      expect("empty_months_charge_usd" in inserts.application_snapshots[0]).toBe(false);
    }
  });
});

