import { describe, expect, it } from "vitest";
import { daysUntil } from "./countdown";
import { isDuplicateSend, isMissingSendsTable, isReminderHour, isReminderReservationStatus, recipientGetsReminder, reminderKeyForDays } from "./reminderPlan";

describe("reminderKeyForDays (ventana de cadencia)", () => {
  it("solo 14, 7, 2 y 0 días disparan aviso", () => {
    expect(reminderKeyForDays(14)).toBe("t14");
    expect(reminderKeyForDays(7)).toBe("t7");
    expect(reminderKeyForDays(2)).toBe("t2");
    expect(reminderKeyForDays(0)).toBe("t0");
    for (const d of [1, 3, 5, 6, 8, 13, 15, 30]) expect(reminderKeyForDays(d)).toBeNull();
    expect(reminderKeyForDays(null)).toBeNull();
  });
  it("fecha pasada no dispara (daysUntil null)", () => {
    expect(reminderKeyForDays(daysUntil("2026-11-01", "2026-11-02"))).toBeNull();
    expect(reminderKeyForDays(daysUntil("2026-11-16", "2026-11-02"))).toBe("t14");
  });
});

describe("isReminderHour (9:00 Argentina, UTC-3)", () => {
  it("antes de las 9 AR no", () => {
    expect(isReminderHour(new Date("2026-11-02T11:59:00Z"))).toBe(false); // 08:59
    expect(isReminderHour(new Date("2026-11-02T03:00:00Z"))).toBe(false); // 00:00
    expect(isReminderHour(new Date("2026-11-03T02:59:00Z"))).toBe(true); // 23:59 AR del 2/11 (cruce UTC)
    expect(isReminderHour(new Date("2026-11-03T03:00:00Z"))).toBe(false); // 00:00 AR del 3/11 (ya es otro día UTC y AR)
  });
  it("desde las 9 AR sí", () => {
    expect(isReminderHour(new Date("2026-11-02T12:00:00Z"))).toBe(true); // 09:00
    expect(isReminderHour(new Date("2026-11-02T23:30:00Z"))).toBe(true); // 20:30
  });
});

describe("destinatarios", () => {
  it("estudiante recibe los cuatro", () => {
    for (const k of ["t14", "t7", "t2", "t0"] as const) expect(recipientGetsReminder("student", k)).toBe(true);
  });
  it("familiar solo t7 y t2", () => {
    expect(recipientGetsReminder("family", "t7")).toBe(true);
    expect(recipientGetsReminder("family", "t2")).toBe(true);
    expect(recipientGetsReminder("family", "t14")).toBe(false);
    expect(recipientGetsReminder("family", "t0")).toBe(false);
  });
  it("solo reservas confirmed/receipt_pending/receipt_issued", () => {
    for (const s of ["confirmed", "receipt_pending", "receipt_issued"]) expect(isReminderReservationStatus(s)).toBe(true);
    for (const s of ["cancelled", "pending", "completed"]) expect(isReminderReservationStatus(s)).toBe(false);
  });
});

describe("idempotencia (códigos de error)", () => {
  it("23505 es duplicado: se saltea; tabla ausente se detecta", () => {
    expect(isDuplicateSend({ code: "23505" })).toBe(true);
    expect(isDuplicateSend(null)).toBe(false);
    expect(isMissingSendsTable({ code: "42P01" })).toBe(true);
    expect(isMissingSendsTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingSendsTable({ code: "23505" })).toBe(false);
  });
});
