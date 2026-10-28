import { describe, expect, it } from "vitest";
import { buildVacancyOutlook, candidateMonthKeys, confirmedEmptyMonthsCharge } from "@/lib/applications/emptyMonths";

const TODAY = "2026-10-28";

describe("candidateMonthKeys", () => {
  it("octubre → diciembre: solo noviembre; octubre → enero: noviembre y diciembre; mes siguiente o actual: ninguno; tope 3", () => {
    expect(candidateMonthKeys("2026-12-01", TODAY)).toEqual(["2026-11"]);
    expect(candidateMonthKeys("2027-01-01", TODAY)).toEqual(["2026-11", "2026-12"]);
    expect(candidateMonthKeys("2026-11-01", TODAY)).toEqual([]);
    expect(candidateMonthKeys("2026-10-30", TODAY)).toEqual([]);
    expect(candidateMonthKeys("2027-09-01", TODAY)).toHaveLength(3);
  });
});

describe("buildVacancyOutlook", () => {
  const base = { today: TODAY, capacity: 2, premium: true, residenceHasStays: true, reservations: [] as { startDate: string; durationMonths: number }[] };
  it("sin Premium, sin capacidad o sin estadías cargadas no es confiable", () => {
    expect(buildVacancyOutlook({ ...base, premium: false, stays: [] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, capacity: 0, stays: [] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, residenceHasStays: false, stays: [] }).reliable).toBe(false);
  });
  it("un mes está vacío si las plazas ocupadas son menos que la capacidad; sin fecha de fin ocupa siempre", () => {
    const stays = [
      { startDate: "2026-01-01", endDate: null },
      { startDate: "2026-01-01", endDate: "2026-11-30" },
    ];
    // noviembre: 2 ocupadas (capacidad 2) → no vacío; diciembre y enero: 1 ocupada → vacío
    expect(buildVacancyOutlook({ ...base, stays })).toEqual({ reliable: true, emptyMonthKeys: ["2026-12", "2027-01"] });
  });
  it("las reservas en curso sin estadía ocupan desde su inicio", () => {
    const stays = [{ startDate: "2026-01-01", endDate: "2026-11-30" }];
    const out = buildVacancyOutlook({ ...base, capacity: 1, stays, reservations: [{ startDate: "2026-12-01", durationMonths: 6 }] });
    expect(out.emptyMonthKeys).toEqual([]);
  });
});

describe("buildVacancyOutlook: reservas inválidas", () => {
  const base = { today: TODAY, capacity: 2, premium: true, residenceHasStays: true, stays: [{ startDate: "2026-01-01", endDate: null }] };
  it("una reserva sin inicio o con duración nula/inválida deja el tipo como no confiable (sin NaN)", () => {
    expect(buildVacancyOutlook({ ...base, reservations: [{ startDate: null, durationMonths: 6 }] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, reservations: [{ startDate: "2026-12-01", durationMonths: null }] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, reservations: [{ startDate: "2026-12-01", durationMonths: Number.NaN }] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, reservations: [{ startDate: "2026-12-01", durationMonths: 0 }] }).reliable).toBe(false);
    expect(buildVacancyOutlook({ ...base, reservations: [{ startDate: "2026-12-01", durationMonths: 6 }] }).reliable).toBe(true);
  });
});

describe("confirmedEmptyMonthsCharge (regla del dueño)", () => {
  const args = { monthlyUsd: 400 } as const;
  const charge = (start: string, vacancy: Parameters<typeof confirmedEmptyMonthsCharge>[0]["vacancy"], pct: number | null = 50) =>
    confirmedEmptyMonthsCharge({ desiredStartDate: start, monthlyPriceUsd: args.monthlyUsd, chargePercent: pct, vacancy, today: TODAY });

  it("octubre → diciembre con noviembre ocupado: no se cobra", () => {
    expect(charge("2026-12-01", { reliable: true, emptyMonthKeys: ["2027-01"] })).toMatchObject({ status: "not_charged", months: 0, chargeUsd: 0 });
  });
  it("octubre → enero con noviembre y diciembre libres: se cobran 2 meses al % de la residencia", () => {
    expect(charge("2027-01-01", { reliable: true, emptyMonthKeys: ["2026-11", "2026-12"] })).toMatchObject({ status: "charged", months: 2, chargeUsd: 400 });
    expect(charge("2027-01-01", { reliable: true, emptyMonthKeys: ["2026-11", "2026-12"] }, 75).chargeUsd).toBe(600);
  });
  it("solo cuentan los meses libres entre hoy y el ingreso", () => {
    expect(charge("2027-01-01", { reliable: true, emptyMonthKeys: ["2026-12"] })).toMatchObject({ months: 1, chargeUsd: 200 });
  });
  it("sin dato confiable: a confirmar y sin monto", () => {
    expect(charge("2027-01-01", null)).toMatchObject({ status: "to_confirm", chargeUsd: 0 });
    expect(charge("2027-01-01", { reliable: false, emptyMonthKeys: [] })).toMatchObject({ status: "to_confirm", chargeUsd: 0 });
  });
  it("reserva no diferida o sin % configurado: none", () => {
    expect(charge("2026-11-01", { reliable: true, emptyMonthKeys: ["2026-11"] }).status).toBe("none");
    expect(charge("2027-01-01", { reliable: true, emptyMonthKeys: ["2026-11"] }, null).status).toBe("none");
    expect(charge("2027-01-01", { reliable: true, emptyMonthKeys: ["2026-11"] }, 0).status).toBe("none");
  });
});
