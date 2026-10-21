import { describe, it, expect } from "vitest";
import {
  addMonthsIso,
  daysUntilDate,
  formatDateOnly,
  resolveContractEnd,
  resolveStayRate,
} from "@/lib/students/contractEnd";

describe("addMonthsIso", () => {
  it("suma meses calendario", () => {
    expect(addMonthsIso("2026-07-20", 6)).toBe("2027-01-20");
    expect(addMonthsIso("2026-08-10", 5)).toBe("2027-01-10");
  });
  it("recorta al último día del mes destino (31 ene + 1 mes = 28 feb)", () => {
    expect(addMonthsIso("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsIso("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsIso("2026-08-31", 6)).toBe("2027-02-28");
  });
  it("cruza de año", () => {
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsIso("2026-11-15", 12)).toBe("2027-11-15");
  });
  it("fecha inválida: la devuelve tal cual (no rompe la pantalla)", () => {
    expect(addMonthsIso("no-es-fecha", 3)).toBe("no-es-fecha");
  });
});

describe("formatDateOnly", () => {
  it("formatea en es-AR sin correr el día por huso horario", () => {
    expect(formatDateOnly("2027-01-20")).toBe("20/01/2027");
    expect(formatDateOnly("2027-07-01")).toBe("01/07/2027");
  });
  it("vacío o inválido → guion", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly(undefined)).toBe("—");
    expect(formatDateOnly("xx")).toBe("—");
  });
});

describe("daysUntilDate", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("cuenta días hasta la fecha (redondeo hacia arriba)", () => {
    expect(daysUntilDate("2026-10-22", now)).toBe(1);
    expect(daysUntilDate("2026-10-31", now)).toBe(10);
  });
  it("hoy o pasado → ≤ 0", () => {
    expect(daysUntilDate("2026-10-21", now)).toBeLessThanOrEqual(0);
    expect(daysUntilDate("2026-01-01", now)).toBeLessThan(0);
  });
  it("cuenta días de calendario en hora argentina (21:00–24:00 locales ya son el día siguiente en UTC)", () => {
    // 2026-10-21 22:30 en Buenos Aires = 2026-10-22T01:30Z. Mañana (22/10) está a 1 día, no a 0.
    const lateNight = new Date("2026-10-22T01:30:00Z");
    expect(daysUntilDate("2026-10-22", lateNight)).toBe(1);
    expect(daysUntilDate("2026-10-21", lateNight)).toBe(0);
    // 00:30 locales (03:30Z) ya es el día nuevo.
    expect(daysUntilDate("2026-10-22", new Date("2026-10-22T03:30:00Z"))).toBe(0);
  });
  it("fecha inválida → 0", () => {
    expect(daysUntilDate("xx", now)).toBe(0);
  });
});

describe("resolveContractEnd", () => {
  const reservation = { startDate: "2026-07-20", initialDurationMonths: 6 };

  it("rama 3 — sin estadía ni renovaciones: start_date + duración inicial", () => {
    const r = resolveContractEnd(reservation);
    expect(r).toEqual({
      endDate: "2027-01-20",
      source: "reservation",
      originalEndDate: "2027-01-20",
      renewedUntil: null,
    });
  });

  it("rama 2 — sin estadía pero con renovación confirmada: usa su period_end_date y marca 'renovada hasta'", () => {
    const r = resolveContractEnd({
      ...reservation,
      renewals: [{ status: "confirmed", periodEndDate: "2027-07-20" }],
    });
    expect(r.source).toBe("renewal");
    expect(r.endDate).toBe("2027-07-20");
    expect(r.renewedUntil).toBe("2027-07-20");
    expect(r.originalEndDate).toBe("2027-01-20");
  });

  it("rama 2 — también cuenta receipt_issued", () => {
    const r = resolveContractEnd({
      ...reservation,
      renewals: [{ status: "receipt_issued", periodEndDate: "2027-07-20" }],
    });
    expect(r.source).toBe("renewal");
  });

  it("rama 2 — con varias renovaciones confirmadas toma la más lejana, sin importar el orden", () => {
    const r = resolveContractEnd({
      ...reservation,
      renewals: [
        { status: "confirmed", periodEndDate: "2028-01-20" },
        { status: "confirmed", periodEndDate: "2027-07-20" },
      ],
    });
    expect(r.endDate).toBe("2028-01-20");
  });

  it("ignora renovaciones que NO están confirmadas (ofertas enviadas, rechazadas, vencidas, pendientes de fee)", () => {
    for (const status of ["draft", "sent", "viewed", "accepted_by_student", "rejected_by_student", "expired", "residence_payment_pending", "estured_fee_pending"]) {
      const r = resolveContractEnd({ ...reservation, renewals: [{ status, periodEndDate: "2027-07-20" }] });
      expect(r.source, status).toBe("reservation");
      expect(r.renewedUntil, status).toBeNull();
    }
  });

  it("ignora renovaciones confirmadas sin fecha de fin", () => {
    const r = resolveContractEnd({ ...reservation, renewals: [{ status: "confirmed", periodEndDate: null }] });
    expect(r.source).toBe("reservation");
  });

  it("rama 1 — la estadía vinculada manda sobre la renovación y la reserva", () => {
    const r = resolveContractEnd({
      ...reservation,
      stayExpectedEndDate: "2027-07-20",
      renewals: [{ status: "confirmed", periodEndDate: "2027-06-01" }],
    });
    expect(r.source).toBe("stay");
    expect(r.endDate).toBe("2027-07-20");
    // Hay renovación confirmada y el fin vigente es posterior al original → "renovada hasta".
    expect(r.renewedUntil).toBe("2027-07-20");
  });

  it("rama 1 — estadía sin renovación: usa la fecha de la estadía pero NO dice 'renovada' aunque sea posterior al original", () => {
    const r = resolveContractEnd({ ...reservation, stayExpectedEndDate: "2027-03-01" });
    expect(r.source).toBe("stay");
    expect(r.endDate).toBe("2027-03-01");
    expect(r.renewedUntil).toBeNull();
  });

  it("rama 1 — la residencia puede acortar la salida: manda la fecha de la estadía y no hay 'renovada hasta'", () => {
    const r = resolveContractEnd({
      ...reservation,
      stayExpectedEndDate: "2027-01-10",
      renewals: [{ status: "confirmed", periodEndDate: "2027-07-20" }],
    });
    expect(r.endDate).toBe("2027-01-10");
    expect(r.renewedUntil).toBeNull();
  });

  it("estadía con fecha vacía o inválida: se ignora y cae a renovación/reserva", () => {
    expect(resolveContractEnd({ ...reservation, stayExpectedEndDate: null }).source).toBe("reservation");
    expect(resolveContractEnd({ ...reservation, stayExpectedEndDate: "" }).source).toBe("reservation");
    expect(resolveContractEnd({ ...reservation, stayExpectedEndDate: "basura" }).source).toBe("reservation");
    expect(
      resolveContractEnd({
        ...reservation,
        stayExpectedEndDate: "basura",
        renewals: [{ status: "confirmed", periodEndDate: "2027-07-20" }],
      }).source,
    ).toBe("renewal");
  });

  it("caso real de la auditoría (Lucía): contrato original → renovación sin superposición", () => {
    const r = resolveContractEnd({
      startDate: "2026-07-20",
      initialDurationMonths: 6,
      stayExpectedEndDate: "2027-07-20",
      renewals: [{ status: "confirmed", periodEndDate: "2027-07-20" }],
    });
    expect(r.originalEndDate).toBe("2027-01-20");
    expect(r.endDate).toBe("2027-07-20");
    expect(r.renewedUntil).toBe("2027-07-20");
  });
});

describe("resolveStayRate", () => {
  it("sin tarifa propia en la estadía: rige la del snapshot y no hay diferencia", () => {
    expect(resolveStayRate({ snapshotRateUsd: 350, stayRateUsd: null })).toEqual({
      currentRateUsd: 350,
      agreedRateUsd: 350,
      differs: false,
    });
  });

  it("tarifa de la estadía igual a la acordada: no difiere", () => {
    const r = resolveStayRate({ snapshotRateUsd: 350, stayRateUsd: 350 });
    expect(r.differs).toBe(false);
    expect(r.currentRateUsd).toBe(350);
  });

  it("tarifa de la estadía distinta: la vigente es la de la estadía y se marca la diferencia", () => {
    expect(resolveStayRate({ snapshotRateUsd: 350, stayRateUsd: 280 })).toEqual({
      currentRateUsd: 280,
      agreedRateUsd: 350,
      differs: true,
    });
    expect(resolveStayRate({ snapshotRateUsd: 350, stayRateUsd: 400 }).differs).toBe(true);
  });

  it("acepta valores numéricos que llegan como string de Postgres (numeric)", () => {
    const r = resolveStayRate({ snapshotRateUsd: "350.00" as unknown as number, stayRateUsd: "350" as unknown as number });
    expect(r.differs).toBe(false);
  });

  it("sin snapshot: usa la de la estadía y no puede afirmar diferencia", () => {
    expect(resolveStayRate({ snapshotRateUsd: null, stayRateUsd: 280 })).toEqual({
      currentRateUsd: 280,
      agreedRateUsd: null,
      differs: false,
    });
  });

  it("sin ninguna tarifa: todo null", () => {
    expect(resolveStayRate({ snapshotRateUsd: undefined, stayRateUsd: undefined })).toEqual({
      currentRateUsd: null,
      agreedRateUsd: null,
      differs: false,
    });
  });

  it("una tarifa de estadía en 0 es una tarifa real (no se confunde con 'sin tarifa')", () => {
    const r = resolveStayRate({ snapshotRateUsd: 350, stayRateUsd: 0 });
    expect(r.currentRateUsd).toBe(0);
    expect(r.differs).toBe(true);
  });
});
