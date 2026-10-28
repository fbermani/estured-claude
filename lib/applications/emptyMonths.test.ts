import { describe, expect, it } from "vitest";
import {
  buildVacancyOutlook,
  confirmedEmptyMonthsCharge,
  measureVacantSpan,
  VACANCY_HORIZON_DAYS,
  type VacancyOutlook,
} from "@/lib/applications/emptyMonths";

const TODAY = "2026-10-28";
const published = (availableFrom: string = TODAY): VacancyOutlook => ({ availableFrom, hasOccupancyData: false, fullRanges: [], horizonEnd: null });
const charge = (start: string, vacancy: VacancyOutlook | null, pct: number | null = 50, monthly = 400) =>
  confirmedEmptyMonthsCharge({ desiredStartDate: start, monthlyPriceUsd: monthly, chargePercent: pct, vacancy, today: TODAY });

describe("measureVacantSpan: meses completos + parcial", () => {
  it("meses completos cuentan 1; más de 15 días = 1 mes; 15 o menos = medio mes", () => {
    expect(measureVacantSpan("2026-10-28", "2026-11-28")).toBe(1);
    expect(measureVacantSpan("2026-10-28", "2026-12-01")).toBe(1.5); // 1 mes + 3 días
    expect(measureVacantSpan("2026-10-28", "2026-12-13")).toBe(1.5); // 15 días exactos
    expect(measureVacantSpan("2026-10-28", "2026-12-14")).toBe(2); // 16 días
    expect(measureVacantSpan("2026-10-28", "2026-12-20")).toBe(2); // 22 días
    expect(measureVacantSpan("2026-10-28", "2026-11-05")).toBe(0.5); // solo 8 días
    expect(measureVacantSpan("2026-10-28", "2026-11-20")).toBe(1); // 23 días = 1 mes
    expect(measureVacantSpan("2026-10-31", "2026-11-30")).toBe(1); // 31/10 + 1 mes se ajusta a fin de mes
    expect(measureVacantSpan("2026-10-28", "2026-10-28")).toBe(0);
  });
});

describe("measureVacantSpan: anclas de fin de mes y bisiestos", () => {
  it("31/1 → 30/3: un mes completo (ancla 28/2) + 30 días = 2; 31/1 → 31/3 = 2 exactos", () => {
    expect(measureVacantSpan("2027-01-31", "2027-03-30")).toBe(2);
    expect(measureVacantSpan("2027-01-31", "2027-03-31")).toBe(2);
    expect(measureVacantSpan("2027-01-31", "2027-02-28")).toBe(1);
  });
  it("bisiesto: 29/1 → 29/2 es un mes; 29/2 → 15/3 son 15 días (medio mes) y 16/3 son 16 (un mes)", () => {
    expect(measureVacantSpan("2028-01-29", "2028-02-29")).toBe(1);
    expect(measureVacantSpan("2028-02-29", "2028-03-15")).toBe(0.5);
    expect(measureVacantSpan("2028-02-29", "2028-03-16")).toBe(1);
    expect(measureVacantSpan("2027-02-28", "2027-03-30")).toBe(1.5); // año no bisiesto: 28/2 + 1 mes = 28/3, +2 días
  });
  it("ancla ajustada y 15/16 días de resto", () => {
    expect(measureVacantSpan("2026-10-31", "2026-12-15")).toBe(1.5); // ancla 30/11 + 15 días
    expect(measureVacantSpan("2026-10-31", "2026-12-16")).toBe(2); // +16 días
  });
});

describe("tramo previo al ingreso: un tramo libre anterior que se ocupó no se suma", () => {
  const T = "2026-01-01";
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  it("vacante 0–19, ocupada 20–40, ingreso día 60: solo cuenta 41–59 (19 días = 1 mes), no los 20 días previos", () => {
    const vacancy: VacancyOutlook = { availableFrom: T, hasOccupancyData: true, fullRanges: [{ from: day(20), to: day(40) }], horizonEnd: day(400) };
    const r = confirmedEmptyMonthsCharge({ desiredStartDate: day(60), monthlyPriceUsd: 400, chargePercent: 50, vacancy, today: T });
    expect(r).toMatchObject({ status: "charged", vacantFrom: day(41), months: 1, chargeUsd: 200 });
  });
  it("si el tramo posterior a la ocupación es corto (≤15 días) cuenta medio mes", () => {
    const vacancy: VacancyOutlook = { availableFrom: T, hasOccupancyData: true, fullRanges: [{ from: day(20), to: day(40) }], horizonEnd: day(400) };
    expect(confirmedEmptyMonthsCharge({ desiredStartDate: day(55), monthlyPriceUsd: 400, chargePercent: 50, vacancy, today: T }).months).toBe(0.5);
  });
});

describe("confirmedEmptyMonthsCharge: disponibilidad publicada (no Premium incluido)", () => {
  it("disponible desde hoy e ingreso 1/12: 1,5 meses al % de la residencia", () => {
    expect(charge("2026-12-01", published())).toMatchObject({ status: "charged", months: 1.5, chargeUsd: 300, vacantFrom: TODAY });
    expect(charge("2026-12-01", published(), 75).chargeUsd).toBe(450);
  });
  it("parciales: más de 15 días suma un mes; 15 o menos, medio", () => {
    expect(charge("2026-12-20", published()).months).toBe(2);
    expect(charge("2026-12-10", published()).months).toBe(1.5);
  });
  it("available_from futuro: el tramo empieza ahí; ingreso en el primer día disponible: no hay mes vacío", () => {
    expect(charge("2026-12-20", published("2026-11-15"))).toMatchObject({ status: "charged", months: 1.5 });
    expect(charge("2026-12-01", published("2026-12-01"))).toMatchObject({ status: "not_charged", chargeUsd: 0 });
    expect(charge("2026-11-20", published("2026-12-01")).status).toBe("not_charged");
  });
  it("tope de 3 meses", () => {
    expect(charge("2027-08-01", published())).toMatchObject({ months: 3, chargeUsd: 600 });
  });
  it("sin disponibilidad publicada o sin dato: a confirmar y sin monto", () => {
    expect(charge("2026-12-01", null)).toMatchObject({ status: "to_confirm", chargeUsd: 0 });
    expect(charge("2026-12-01", { ...published(), availableFrom: null })).toMatchObject({ status: "to_confirm", chargeUsd: 0 });
  });
  it("sin %, ingreso hoy o pasado: none", () => {
    expect(charge("2026-12-01", published(), null).status).toBe("none");
    expect(charge("2026-12-01", published(), 0).status).toBe("none");
    expect(charge(TODAY, published()).status).toBe("none");
  });
});

describe("ocupación real (Premium) descarta tramos ocupados", () => {
  const occupied = (to: string, horizonEnd = "2027-12-01"): VacancyOutlook => ({
    availableFrom: TODAY,
    hasOccupancyData: true,
    fullRanges: [{ from: TODAY, to }],
    horizonEnd,
  });
  it("octubre → diciembre con noviembre ocupado: no se cobra", () => {
    expect(charge("2026-12-01", occupied("2026-11-30"))).toMatchObject({ status: "not_charged", chargeUsd: 0 });
  });
  it("octubre → enero con noviembre ocupado: solo se cuenta desde que queda libre", () => {
    expect(charge("2027-01-01", occupied("2026-11-30"))).toMatchObject({ status: "charged", months: 1, vacantFrom: "2026-12-01", chargeUsd: 200 });
  });
  it("un tramo ocupado posterior al ingreso no afecta; un ingreso más allá del horizonte queda a confirmar", () => {
    // ocupada recién desde 2027-01-01 (posterior al ingreso): no afecta
    expect(charge("2026-12-01", { ...occupied("2027-03-01"), fullRanges: [{ from: "2027-01-01", to: "2027-03-01" }] }).status).toBe("charged");
    // ocupada hasta después del ingreso: no hay tramo vacío antes de ingresar
    expect(charge("2026-12-01", occupied("2027-03-01")).status).toBe("not_charged");
    expect(charge("2028-06-01", occupied("2026-11-30", "2027-12-01")).status).toBe("to_confirm");
  });
});

describe("buildVacancyOutlook", () => {
  const base = { today: TODAY, capacity: 1, premium: true, residenceHasStays: true, availableFrom: TODAY, reservations: [] as { startDate: string | null; durationMonths: number | null }[] };
  it("no Premium: solo disponibilidad publicada (sin rangos ocupados) y cobra igual", () => {
    const out = buildVacancyOutlook({ ...base, premium: false, stays: [] });
    expect(out).toEqual({ availableFrom: TODAY, hasOccupancyData: false, fullRanges: [], horizonEnd: null });
    expect(charge("2026-12-01", out).status).toBe("charged");
  });
  it("Premium: una estadía que termina el 30/11 completa la plaza hasta esa fecha", () => {
    const out = buildVacancyOutlook({ ...base, stays: [{ startDate: "2026-01-01", endDate: "2026-11-30" }] });
    expect(out.hasOccupancyData).toBe(true);
    expect(out.fullRanges).toEqual([{ from: TODAY, to: "2026-11-30" }]);
    expect(out.horizonEnd).toBe("2027-12-02");
    expect(VACANCY_HORIZON_DAYS).toBe(400);
  });
  it("sin fecha de fin ocupa siempre; reservas vigentes ocupan desde su inicio", () => {
    expect(buildVacancyOutlook({ ...base, stays: [{ startDate: null, endDate: null }] }).fullRanges[0].to).toBe("2027-12-02");
    const out = buildVacancyOutlook({ ...base, stays: [{ startDate: "2026-01-01", endDate: "2026-11-30" }], reservations: [{ startDate: "2026-12-15", durationMonths: 1 }] });
    expect(out.fullRanges).toEqual([{ from: TODAY, to: "2026-11-30" }, { from: "2026-12-15", to: "2027-01-14" }]);
  });
  it("reserva sin inicio o con duración inválida: se descarta la ocupación real (queda la disponibilidad publicada)", () => {
    for (const bad of [
      { startDate: null, durationMonths: 6 },
      { startDate: "2026-12-01", durationMonths: null },
      { startDate: "2026-12-01", durationMonths: Number.NaN },
      { startDate: "2026-12-01", durationMonths: 0 },
    ]) {
      expect(buildVacancyOutlook({ ...base, stays: [{ startDate: null, endDate: null }], reservations: [bad] }).hasOccupancyData).toBe(false);
    }
  });
  it("sin capacidad o sin estadías cargadas no hay ocupación real", () => {
    expect(buildVacancyOutlook({ ...base, capacity: 0, stays: [] }).hasOccupancyData).toBe(false);
    expect(buildVacancyOutlook({ ...base, residenceHasStays: false, stays: [] }).hasOccupancyData).toBe(false);
  });
});
